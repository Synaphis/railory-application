import {
  getServiceClient,
  corsResponse,
  jsonResponse,
  errorResponse,
} from "../_shared/auth.ts";

/**
 * GET /get-outfit-preview?id=<outfit_uuid>
 *
 * Public (no JWT). Returns shareable outfit data for the marketing-side
 * /o/{id} page. UUIDs are unguessable (128-bit), which provides the
 * security model — same pattern as Google Docs / Imgur "share by link".
 *
 * Returns only public-safe fields. The user_id is never exposed.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);
  if (req.method !== "GET") {
    return errorResponse("Method not allowed", 405, req);
  }

  try {
    const url = new URL(req.url);
    const outfitId = url.searchParams.get("id");

    if (!outfitId) {
      return errorResponse("Missing required query param: id", 400, req);
    }

    // UUID validation — reject malformed IDs fast without hitting DB
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(outfitId)) {
      return errorResponse("Invalid outfit id", 400, req);
    }

    const db = getServiceClient();

    // Single query with joins — outfit + session prompt + items + products
    const { data: outfit, error } = await db
      .from("outfits")
      .select(
        `
        id,
        preview_image,
        ai_reasoning,
        total_price,
        created_at,
        outfit_sessions ( initial_prompt ),
        outfit_items (
          role,
          products (
            id, name, price, currency, images, product_url, colours,
            brands ( name ),
            categories ( name )
          )
        )
        `
      )
      .eq("id", outfitId)
      .single();

    if (error || !outfit) {
      return errorResponse("Outfit not found", 404, req);
    }

    // Only expose outfits that actually have a preview image generated
    // (no point sharing a card with no hero image)
    if (!outfit.preview_image) {
      return errorResponse("Outfit preview not available", 404, req);
    }

    // deno-lint-ignore no-explicit-any
    const session = outfit.outfit_sessions as any;
    // deno-lint-ignore no-explicit-any
    const items = (outfit.outfit_items as any[]) ?? [];

    // Reshape into the public view — strip any internal IDs/fields the
    // marketing page doesn't need
    return jsonResponse(
      {
        id: outfit.id,
        preview_image: outfit.preview_image,
        ai_reasoning: outfit.ai_reasoning,
        total_price: outfit.total_price,
        currency: items[0]?.products?.currency ?? "USD",
        prompt: session?.initial_prompt ?? null,
        created_at: outfit.created_at,
        items: items
          .filter((i) => i.products)
          .map((i) => ({
            role: i.role,
            product: {
              id: i.products.id,
              name: i.products.name,
              brand_name: i.products.brands?.name ?? "Unknown",
              category_name: i.products.categories?.name ?? "",
              price: i.products.price,
              currency: i.products.currency,
              images: i.products.images ?? [],
              colours: i.products.colours ?? [],
              product_url: i.products.product_url,
            },
          })),
      },
      200,
      req
    );
  } catch (err) {
    console.error("[get-outfit-preview]", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
      req
    );
  }
});
