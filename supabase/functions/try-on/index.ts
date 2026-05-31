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

/**
 * POST /try-on
 *
 * Body: {
 *   model_image: string,
 *   garments: { role: string, image: string, name: string }[],
 *   angle?: string,
 *   reference_image?: string,
 *   body_context?: { ... },
 *   preview?: boolean,       // free preview (no limits, no usage)
 *   outfit_id?: string       // required when preview=true (ownership check)
 *   pose?: string            // optional pose hint for preview variety
 * }
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);

  try {
    /* ── Auth ── */
    const { user, error: authError } = await authenticateRequest(req);
    if (!user) return errorResponse(authError ?? "Unauthorized", 401);

    /* ── Rate limit ── */
    if (!checkRateLimit(user.id, "try-on")) {
      return rateLimitResponse(req);
    }

    const db = getServiceClient();

    /* ── Parse input ── */
    const {
      model_image,
      garments,
      angle,
      reference_image,
      body_context,
      preview,
      outfit_id,
      pose,
    } = (await req.json()) as {
      model_image: string;
      garments: Garment[];
      angle?: string;
      reference_image?: string;
      body_context?: {
        height_cm?: number | null;
        weight_kg?: number | null;
        body_type?: string | null;
        gender_presentation?: string | null;
        skin_tone?: string | null;
      };
      preview?: boolean;
      outfit_id?: string;
      pose?: string;
    };

    if (!model_image || !garments?.length) {
      return errorResponse(
        "model_image and at least one garment are required"
      );
    }

    if (garments.length > MAX_GARMENTS) {
      return errorResponse(`Too many garments (max ${MAX_GARMENTS})`);
    }

    const isPreview = preview === true;

    /* ── Preview mode: validate outfit ownership, skip limits ── */
    if (isPreview) {
      if (!outfit_id) {
        return errorResponse("outfit_id is required for preview mode");
      }

      // Verify the outfit belongs to the user via outfit_sessions
      const { data: outfit } = await db
        .from("outfits")
        .select("id, outfit_sessions!inner(user_id)")
        .eq("id", outfit_id)
        .single();

      const sessionUserId =
        (outfit?.outfit_sessions as { user_id?: string } | null)?.user_id;

      if (!outfit || sessionUserId !== user.id) {
        return errorResponse("Outfit not found", 404);
      }
    }

    /* ── Standard mode: atomic check + pre-increment ── */
    if (!isPreview) {
      const tryOnLimit = await checkAndIncrementTryOn(db, user.id);
      if (!tryOnLimit.allowed) {
        if (tryOnLimit.limit === 0) {
          return featureGatedResponse("Virtual try-on", tryOnLimit.plan);
        }
        return limitResponse("try_ons", tryOnLimit);
      }

      /* ── Angle limit check ── */
      if (angle && angle !== "front") {
        const { angles: maxAngles, plan } = await getAllowedAngles(db, user.id);
        const ANGLE_LIST = Object.keys(ANGLE_DESCRIPTIONS);
        const angleIdx = ANGLE_LIST.indexOf(angle);
        if (angleIdx >= maxAngles) {
          return featureGatedResponse(
            `"${angle}" angle (requires ${angleIdx < 7 ? "Starter" : "Pro"} plan)`,
            plan
          );
        }
      }
    }

    /* ── Generate ── */
    const result = await generateTryOnImage({
      modelImage: model_image,
      garments,
      angle: isPreview ? undefined : angle,
      referenceImage: isPreview ? undefined : reference_image,
      bodyContext: body_context,
      pose: isPreview ? pose : undefined,
      preview: isPreview,
    });

    if (!result.ok) {
      return errorResponse(result.error, 502);
    }

    // ── Post-generation pipeline (watermark + persist) ──
    //
    // ABSOLUTE GUARANTEE: the user has paid for this try-on and MUST get
    // their image. The watermark and persistence steps are extras for our
    // brand/storage — they enhance our position but must never block the
    // user's response.
    //
    // Defence in depth:
    //   - outputUrl is seeded with the AI's raw url BEFORE anything risky
    //   - Each sub-step has its own try/catch
    //   - applyWatermark() is internally fail-open
    //   - The whole pipeline is also wrapped in a top-level try/catch as
    //     a last resort — any unexpected throw falls through to returning
    //     the AI's raw url unchanged

    let outputUrl = result.url;

    try {
      let imageBytes: Uint8Array | null = null;
      let mimeType = "image/png";

      // Step 1 — decode the AI's base64 result into raw bytes
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
        console.warn("[try-on] Decode failed:", err);
      }

      // Step 2 — apply watermark (fail-open internally)
      if (imageBytes) {
        imageBytes = await applyWatermark(imageBytes);

        // Step 3 — re-encode as data URL for callers without outfit_id
        try {
          let binary = "";
          for (let i = 0; i < imageBytes.length; i++) {
            binary += String.fromCharCode(imageBytes[i]);
          }
          outputUrl = `data:${mimeType};base64,${btoa(binary)}`;
        } catch (err) {
          console.warn("[try-on] Re-encode failed:", err);
        }
      }

      // Step 4 — persist to storage when outfit_id is provided
      if (outfit_id && imageBytes) {
        try {
          const ext = mimeType.includes("png") ? "png" : "jpg";
          const suffix = angle
            ? angle
            : isPreview
              ? "preview"
              : Date.now().toString();
          const filePath = `${user.id}/${outfit_id}/${suffix}.${ext}`;

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

              // Update preview_image on the outfit row (latest try-on)
              await db
                .from("outfits")
                .update({ preview_image: outputUrl })
                .eq("id", outfit_id);
            }
          } else {
            console.error("[try-on] Upload error:", uploadErr);
          }
        } catch (err) {
          console.error("[try-on] Persist error:", err);
        }
      }
    } catch (err) {
      // Last-resort safety net — any uncaught error in the pipeline above
      // falls through to here, leaving outputUrl = result.url unchanged.
      // The user gets their unmarked, unpersisted, but FUNCTIONAL image.
      console.warn(
        "[try-on] Post-generation pipeline failed unexpectedly — returning raw AI image:",
        err
      );
    }

    // Usage already pre-incremented in checkAndIncrementTryOn (step above)

    return jsonResponse({ output_url: outputUrl });
  } catch (err) {
    console.error("[try-on] Unexpected error:", err);
    // Rollback the pre-incremented usage on failure
    try {
      const { user: u } = await authenticateRequest(req);
      if (u) await rollbackUsage(getServiceClient(), u.id, "try_ons");
    } catch { /* best effort */ }
    return errorResponse("Internal server error", 500);
  }
});
