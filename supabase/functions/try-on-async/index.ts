/**
 * POST /try-on-async
 *
 * Async sibling of /try-on. Atomically deducts the try-on credit and
 * inserts a 'pending' row into try_on_jobs, returns the job_id
 * immediately, then continues the AI work in the background via
 * EdgeRuntime.waitUntil.
 *
 * Designed for native clients where the synchronous /try-on flow
 * hits HTTP timeout (~30s default) on slow AI provider responses.
 *
 * Native clients should:
 *   1. POST /try-on-async with the same body shape as /try-on
 *   2. Receive { job_id, status: "pending" } in <1s
 *   3. Either:
 *      a) Subscribe to public.try_on_jobs via Supabase Realtime,
 *         filter user_id = self, watch for status -> completed
 *      b) Poll public.try_on_jobs (id = job_id) every 3-5 seconds
 *   4. When status = 'completed', read output_url
 *   5. When status = 'failed', show error message — credit was rolled
 *      back automatically
 *
 * Credit handling: charged synchronously at request time (so the user
 * can't spam past their cap). Refunded if the AI work fails. A separate
 * reclaim_stuck_jobs() function refunds jobs that get stuck >5 min
 * (e.g. function instance killed mid-processing).
 */

import {
  authenticateRequest,
  getServiceClient,
  corsResponse,
  jsonResponse,
  errorResponse,
  checkRateLimit,
  rateLimitResponse,
  MAX_GARMENTS,
} from "../_shared/auth.ts";
import {
  checkAndIncrementTryOn,
  rollbackUsage,
  limitResponse,
  featureGatedResponse,
  getAllowedAngles,
} from "../_shared/subscription.ts";
import {
  generateTryOnImage,
  ANGLE_DESCRIPTIONS,
  type Garment,
} from "../_shared/try-on.ts";
import { applyWatermark } from "../_shared/watermark.ts";

// Type stub for the Supabase Edge runtime helper that lets background
// work continue after the response is sent.
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req);
  }

  try {
    const { user, error: authError } = await authenticateRequest(req);
    if (!user) return errorResponse(authError ?? "Unauthorized", 401, req);

    if (!checkRateLimit(user.id, "try-on")) {
      return rateLimitResponse(req);
    }

    const body = await req.json().catch(() => ({}));
    const {
      model_image,
      garments,
      angle,
      reference_image,
      body_context,
      preview,
      outfit_id,
      pose,
    } = body as {
      model_image?: string;
      garments?: Garment[];
      angle?: string;
      reference_image?: string;
      body_context?: unknown;
      preview?: boolean;
      outfit_id?: string;
      pose?: string;
    };

    // ── Input validation (same as sync /try-on) ──
    if (!model_image || typeof model_image !== "string") {
      return errorResponse("model_image is required", 400, req);
    }
    if (!Array.isArray(garments) || garments.length === 0) {
      return errorResponse("garments array is required", 400, req);
    }
    if (garments.length > MAX_GARMENTS) {
      return errorResponse(`max ${MAX_GARMENTS} garments`, 400, req);
    }

    const isPreview = preview === true;
    const db = getServiceClient();

    // For preview mode, validate outfit ownership (same as sync /try-on)
    if (isPreview) {
      if (!outfit_id) {
        return errorResponse("outfit_id is required for preview mode", 400, req);
      }
      const { data: outfit } = await db
        .from("outfits")
        .select("session_id, outfit_sessions ( user_id )")
        .eq("id", outfit_id)
        .single();

      // deno-lint-ignore no-explicit-any
      const ownerId = (outfit as any)?.outfit_sessions?.user_id;
      if (!outfit || ownerId !== user.id) {
        return errorResponse("Outfit not found or not owned", 403, req);
      }
    }

    // ── Plan-gate angle (same as sync /try-on) ──
    if (angle && !isPreview) {
      const { angles: allowedAngleCount, plan } = await getAllowedAngles(
        db,
        user.id
      );
      const angleIdx = Object.keys(ANGLE_DESCRIPTIONS).indexOf(angle);
      if (angleIdx >= allowedAngleCount) {
        return featureGatedResponse(
          `"${angle}" angle (requires ${angleIdx < 7 ? "Starter" : "Pro"} plan)`,
          plan
        );
      }
    }

    // ── Atomic credit deduction (preview mode is free; standard counts) ──
    let creditCharged = false;
    if (!isPreview) {
      const tryOnLimit = await checkAndIncrementTryOn(db, user.id);
      if (!tryOnLimit.allowed) {
        return limitResponse("try_ons", tryOnLimit);
      }
      creditCharged = true;
    }

    // ── Create the job row ──
    const { data: jobRow, error: jobErr } = await db
      .from("try_on_jobs")
      .insert({
        user_id: user.id,
        outfit_id: outfit_id ?? null,
        request: body,
        status: "pending",
        credit_charged: creditCharged,
      })
      .select("id")
      .single();

    if (jobErr || !jobRow) {
      // Job row creation failed — rollback the credit since we can't track this
      if (creditCharged) {
        await rollbackUsage(db, user.id, "try_ons");
      }
      console.error("[try-on-async] Job insert failed:", jobErr);
      return errorResponse("Failed to queue try-on job", 500, req);
    }

    const jobId = jobRow.id as string;

    // ── Kick off async processing ──
    // EdgeRuntime.waitUntil keeps the work running after we return the response.
    // If the function instance is terminated before completion, reclaim_stuck_jobs()
    // (runs via pg_cron every minute) will mark this job failed and refund the credit.
    EdgeRuntime.waitUntil(
      processTryOnJob({
        jobId,
        userId: user.id,
        modelImage: model_image,
        garments,
        angle,
        referenceImage: reference_image,
        bodyContext: body_context as Record<string, unknown> | null,
        preview: isPreview,
        outfitId: outfit_id,
        pose,
        creditCharged,
      })
    );

    // Return immediately with the job ID so the client can stop waiting
    return jsonResponse(
      { job_id: jobId, status: "pending" },
      202, // Accepted — request received, processing async
      req
    );
  } catch (err) {
    console.error("[try-on-async] Unexpected setup error:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
      req
    );
  }
});

/* ── Background processor ──────────────────────────────────── */

interface ProcessParams {
  jobId: string;
  userId: string;
  modelImage: string;
  garments: Garment[];
  angle?: string;
  referenceImage?: string;
  bodyContext: Record<string, unknown> | null;
  preview: boolean;
  outfitId?: string;
  pose?: string;
  creditCharged: boolean;
}

async function processTryOnJob(p: ProcessParams): Promise<void> {
  const db = getServiceClient();

  // Mark processing
  await db
    .from("try_on_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", p.jobId);

  try {
    // ── AI generation ──
    const result = await generateTryOnImage({
      modelImage: p.modelImage,
      garments: p.garments,
      angle: p.preview ? undefined : p.angle,
      referenceImage: p.preview ? undefined : p.referenceImage,
      // deno-lint-ignore no-explicit-any
      bodyContext: p.bodyContext as any,
      pose: p.preview ? p.pose : undefined,
      preview: p.preview,
    });

    if (!result.ok) {
      await failJob(db, p, result.error);
      return;
    }

    // ── Watermark + persist (mirrors sync /try-on, fail-open at each step) ──
    let outputUrl = result.url;
    let imageBytes: Uint8Array | null = null;
    let mimeType = "image/png";

    try {
      const match = result.url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        const binaryStr = atob(match[2]);
        imageBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          imageBytes[i] = binaryStr.charCodeAt(i);
        }
      }
    } catch (err) {
      console.warn("[try-on-async] Decode failed:", err);
    }

    if (imageBytes) {
      imageBytes = await applyWatermark(imageBytes);

      try {
        let binary = "";
        for (let i = 0; i < imageBytes.length; i++) {
          binary += String.fromCharCode(imageBytes[i]);
        }
        outputUrl = `data:${mimeType};base64,${btoa(binary)}`;
      } catch (err) {
        console.warn("[try-on-async] Re-encode failed:", err);
      }
    }

    // Persist to storage if we have an outfit_id (preview + saved try-ons)
    if (p.outfitId && imageBytes) {
      try {
        const ext = mimeType.includes("png") ? "png" : "jpg";
        const suffix = p.angle
          ? p.angle
          : p.preview
            ? "preview"
            : Date.now().toString();
        const filePath = `${p.userId}/${p.outfitId}/${suffix}.${ext}`;

        const { error: uploadErr } = await db.storage
          .from("outfit-previews")
          .upload(filePath, imageBytes.buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (!uploadErr) {
          const { data: publicUrlData } = db.storage
            .from("outfit-previews")
            .getPublicUrl(filePath);

          if (publicUrlData?.publicUrl) {
            outputUrl = publicUrlData.publicUrl;
            await db
              .from("outfits")
              .update({ preview_image: outputUrl })
              .eq("id", p.outfitId);
          }
        } else {
          console.error("[try-on-async] Upload error:", uploadErr);
        }
      } catch (err) {
        console.error("[try-on-async] Persist error:", err);
      }
    }

    // ── Mark completed ──
    await db
      .from("try_on_jobs")
      .update({
        status: "completed",
        output_url: outputUrl,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })
      .eq("id", p.jobId);
  } catch (err) {
    await failJob(
      db,
      p,
      err instanceof Error ? err.message : "Unknown processing error"
    );
  }
}

// deno-lint-ignore no-explicit-any
async function failJob(db: any, p: ProcessParams, errMsg: string): Promise<void> {
  console.error(`[try-on-async] Job ${p.jobId} failed:`, errMsg);

  // Mark job failed
  await db
    .from("try_on_jobs")
    .update({
      status: "failed",
      error: errMsg,
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq("id", p.jobId);

  // Refund the credit (only if it was actually charged)
  if (p.creditCharged) {
    try {
      await rollbackUsage(db, p.userId, "try_ons");
      await db
        .from("try_on_jobs")
        .update({ credit_charged: false })
        .eq("id", p.jobId);
    } catch (rbErr) {
      console.error("[try-on-async] Credit rollback failed:", rbErr);
    }
  }
}
