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
  checkCustomAvatarAllowed,
  featureGatedResponse,
} from "../_shared/subscription.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);

  try {
    const { user, error: authError } = await authenticateRequest(req);
    if (!user) return errorResponse(authError ?? "Unauthorized", 401);

    if (!checkRateLimit(user.id, "profile")) {
      return rateLimitResponse(req);
    }

    const serviceClient = getServiceClient();

    // ── GET: fetch profile ──
    if (req.method === "GET") {
      const { data, error } = await serviceClient
        .from("users")
        .select(
          "custom_avatar_url, height_cm, weight_kg, body_type, gender_presentation, skin_tone, hair_colour, hair_length, age_range, country, preferred_currency"
        )
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("[profile] Fetch error:", error);
        return errorResponse("Failed to fetch profile", 500);
      }

      // custom_avatar_url stores a path — resolve to signed URL
      if (data?.custom_avatar_url) {
        const { data: signedData } = await serviceClient.storage
          .from("user-avatars")
          .createSignedUrl(data.custom_avatar_url, 60 * 60);

        data.custom_avatar_url = signedData?.signedUrl ?? null;
      }

      return jsonResponse(data);
    }

    // ── PATCH: update body profile fields ──
    if (req.method === "PATCH") {
      const body = await req.json();

      const allowed = [
        "height_cm",
        "weight_kg",
        "body_type",
        "gender_presentation",
        "skin_tone",
        "hair_colour",
        "hair_length",
        "age_range",
        "country",
        "preferred_currency",
      ];
      const updates: Record<string, unknown> = {};
      for (const key of allowed) {
        if (key in body) updates[key] = body[key];
      }

      if (Object.keys(updates).length === 0) {
        return errorResponse("No valid fields provided");
      }

      const { error } = await serviceClient
        .from("users")
        .update(updates)
        .eq("id", user.id);

      if (error) {
        console.error("[profile] Update error:", error);
        return errorResponse("Failed to update profile", 500);
      }

      return jsonResponse({ ok: true });
    }

    // ── POST: upload avatar image ──
    if (req.method === "POST") {
      // Gate custom avatar uploads to Pro plan
      const avatarCheck = await checkCustomAvatarAllowed(serviceClient, user.id);
      if (!avatarCheck.allowed) {
        return featureGatedResponse("Custom avatar uploads", avatarCheck.plan);
      }

      const formData = await req.formData();
      const file = formData.get("avatar") as File | null;

      if (!file) {
        return errorResponse("No file provided");
      }

      if (!file.type.startsWith("image/")) {
        return errorResponse("File must be an image");
      }

      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        return errorResponse("Image must be under 10MB");
      }

      const ext = file.type.includes("png") ? "png" : "jpg";
      const filePath = `${user.id}/avatar.${ext}`;

      const buffer = await file.arrayBuffer();

      const { error: uploadError } = await serviceClient.storage
        .from("user-avatars")
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error("[profile] Upload error:", uploadError);
        return errorResponse("Failed to upload avatar", 500);
      }

      // Store the path in DB
      const { error: updateError } = await serviceClient
        .from("users")
        .update({ custom_avatar_url: filePath })
        .eq("id", user.id);

      if (updateError) {
        console.error("[profile] URL save error:", updateError);
        return errorResponse("Failed to save avatar URL", 500);
      }

      // Return a signed URL for immediate display
      const { data: signedData, error: signError } =
        await serviceClient.storage
          .from("user-avatars")
          .createSignedUrl(filePath, 60 * 60);

      if (signError || !signedData?.signedUrl) {
        console.error("[profile] Signed URL error:", signError);
        return errorResponse(
          "Uploaded but failed to generate URL",
          500
        );
      }

      return jsonResponse({ custom_avatar_url: signedData.signedUrl });
    }

    return errorResponse("Method not allowed", 405);
  } catch (err) {
    console.error("[profile]", err);
    return errorResponse("Internal server error", 500);
  }
});
