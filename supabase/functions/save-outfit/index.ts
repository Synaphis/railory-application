import {
  authenticateRequest,
  getServiceClient,
  corsResponse,
  jsonResponse,
  errorResponse,
  checkRateLimit,
  rateLimitResponse,
} from "../_shared/auth.ts";
import {
  checkSavedLimit,
  limitResponse,
} from "../_shared/subscription.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);

  try {
    const { user, error: authError } = await authenticateRequest(req);
    if (!user) return errorResponse(authError ?? "Unauthorized", 401);

    if (!checkRateLimit(user.id, "save-outfit")) {
      return rateLimitResponse(req);
    }

    const serviceClient = getServiceClient();

    // ── SAVE (POST) ──
    if (req.method === "POST") {
      // Check saved looks limit before saving
      const savedLimit = await checkSavedLimit(serviceClient, user.id);
      if (!savedLimit.allowed) return limitResponse("saved_looks", savedLimit);

      const { outfit_id } = await req.json();
      if (!outfit_id) return errorResponse("outfit_id required");

      const { error } = await serviceClient
        .from("saved_outfits")
        .upsert(
          { user_id: user.id, outfit_id },
          { onConflict: "user_id,outfit_id", ignoreDuplicates: true }
        );

      if (error) throw error;
      return jsonResponse({ saved: true });
    }

    // ── UNSAVE (DELETE) ──
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const saved_id = url.searchParams.get("saved_id");
      if (!saved_id) return errorResponse("saved_id required");

      const { error } = await serviceClient
        .from("saved_outfits")
        .delete()
        .eq("id", saved_id)
        .eq("user_id", user.id);

      if (error) throw error;
      return jsonResponse({ saved: false });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err) {
    console.error("[save-outfit]", err);
    return errorResponse("Failed to save/unsave", 500);
  }
});
