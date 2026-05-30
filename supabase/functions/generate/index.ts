import {
  authenticateRequest,
  getServiceClient,
  corsResponse,
  jsonResponse,
  errorResponse,
  checkRateLimit,
  rateLimitResponse,
  MAX_PROMPT_LENGTH,
} from "../_shared/auth.ts";
import {
  checkAndIncrementGeneration,
  rollbackUsage,
  limitResponse,
} from "../_shared/subscription.ts";
import {
  convertCurrency,
  inferCurrencyFromUrl,
  brandShippingScore,
  CURRENCY_SYMBOLS,
} from "../_shared/currency.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const STYLIST_SYSTEM_PROMPT = `You are an expert personal fashion stylist with memory.
Build exactly 4 complete outfit combinations from the available products.

You may receive a STYLE MEMORY section — this captures the user's demonstrated taste from their saved outfits, past requests, and profile. Use it to:
- Lean into brands, aesthetics, and colour palettes they gravitate toward.
- Respect their body type and presentation when judging fit.
- Evolve their style — don't just repeat past outfits, but build on what they love.
- If the current brief contradicts their taste, honour the brief but incorporate subtle nods to their preferences where appropriate.

Rules:
- Each outfit MUST have: one top (t-shirt or shirt), one bottom (trousers), one shoe or boot.
- Jacket is optional — include if it improves the look.
- Never use the same product_id in two different outfits.
- CRITICAL: You MUST use the exact "id" field from the provided products list. Do NOT invent or modify product IDs. Every product_id in your response must appear verbatim in the input.
- Total price of each outfit must not exceed the budget if one is specified.
- Each product has a "display_price" field showing its price in the user's currency — use this for budget checks and the total_price field.
- Think about colour harmony, occasion fit, and overall coherence.
- Write reasoning as a stylist would — confident, specific, 1-2 sentences. Reference the user's style when relevant (e.g. "Plays into your love of minimalist streetwear…").

Return ONLY valid JSON in this exact shape:
{
  "outfits": [
    {
      "outfit_number": 1,
      "reasoning": "string",
      "items": [
        { "product_id": "uuid", "role": "top" },
        { "product_id": "uuid", "role": "bottom" },
        { "product_id": "uuid", "role": "shoe" },
        { "product_id": "uuid", "role": "jacket" }
      ],
      "total_price": 0.00
    }
  ]
}`;

interface GeneratedOutfit {
  outfit_number: number;
  reasoning: string;
  items: { product_id: string; role: string }[];
  total_price: number;
}

interface Brand {
  id: string;
  name: string;
  base_url: string | null;
}

/* ── Style Memory Builder ──────────────────────────────────
   Aggregates signals from saved outfits, past prompts, and
   profile into a compact summary for GPT personalisation.
   ──────────────────────────────────────────────────────── */

// deno-lint-ignore no-explicit-any
async function buildStyleMemory(db: any, userId: string, profile: any): Promise<string | null> {
  try {
    // 1. Saved outfits — strongest signal (user explicitly liked these)
    const { data: savedRows } = await db
      .from("saved_outfits")
      .select(`
        outfits (
          prompt_used,
          outfit_items (
            role,
            products ( name, style_tags, occasion_tags, aesthetic_tags, colours, brands ( name ) )
          )
        )
      `)
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .limit(10);

    // 2. Recent prompts — what the user has been asking for
    const { data: sessionRows } = await db
      .from("outfit_sessions")
      .select("initial_prompt")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);

    // Aggregate style signals
    const brandCounts: Record<string, number> = {};
    const styleCounts: Record<string, number> = {};
    const occasionCounts: Record<string, number> = {};
    const aestheticCounts: Record<string, number> = {};
    const colourCounts: Record<string, number> = {};

    type SavedRow = {
      outfits: {
        prompt_used: string;
        outfit_items: {
          role: string;
          products: {
            name: string;
            style_tags: string[];
            occasion_tags: string[];
            aesthetic_tags: string[];
            colours: string[];
            brands: { name: string } | null;
          };
        }[];
      };
    };

    for (const row of (savedRows ?? []) as unknown as SavedRow[]) {
      const outfit = row.outfits;
      if (!outfit?.outfit_items) continue;
      for (const item of outfit.outfit_items) {
        const p = item.products;
        if (!p) continue;
        if (p.brands?.name) brandCounts[p.brands.name] = (brandCounts[p.brands.name] ?? 0) + 1;
        for (const t of p.style_tags ?? []) styleCounts[t] = (styleCounts[t] ?? 0) + 1;
        for (const t of p.occasion_tags ?? []) occasionCounts[t] = (occasionCounts[t] ?? 0) + 1;
        for (const t of p.aesthetic_tags ?? []) aestheticCounts[t] = (aestheticCounts[t] ?? 0) + 1;
        for (const c of p.colours ?? []) colourCounts[c] = (colourCounts[c] ?? 0) + 1;
      }
    }

    // Build compact summary
    const lines: string[] = [];

    // Profile
    const profileParts: string[] = [];
    if (profile?.gender_presentation) profileParts.push(`presents ${profile.gender_presentation}`);
    if (profile?.body_type) profileParts.push(`${profile.body_type} build`);
    if (profile?.age_range) profileParts.push(`age ${profile.age_range}`);
    if (profile?.skin_tone) profileParts.push(`${profile.skin_tone} skin tone`);
    if (profileParts.length > 0) {
      lines.push(`Profile: ${profileParts.join(", ")}`);
    }

    // Top brands, styles, aesthetics (sorted by frequency, top 5 each)
    const topN = (counts: Record<string, number>, n: number) =>
      Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

    const topBrands = topN(brandCounts, 5);
    const topStyles = topN(styleCounts, 6);
    const topOccasions = topN(occasionCounts, 4);
    const topAesthetics = topN(aestheticCounts, 5);
    const topColours = topN(colourCounts, 5);

    if (topBrands.length > 0) lines.push(`Favourite brands: ${topBrands.join(", ")}`);
    if (topAesthetics.length > 0) lines.push(`Aesthetic preferences: ${topAesthetics.join(", ")}`);
    if (topStyles.length > 0) lines.push(`Style tendencies: ${topStyles.join(", ")}`);
    if (topColours.length > 0) lines.push(`Colour palette: ${topColours.join(", ")}`);
    if (topOccasions.length > 0) lines.push(`Typical occasions: ${topOccasions.join(", ")}`);

    // Recent prompts
    const prompts = (sessionRows ?? [])
      .map((r: { initial_prompt: string }) => r.initial_prompt)
      .filter(Boolean)
      .slice(0, 5);
    if (prompts.length > 0) {
      lines.push(`Recent styling requests: ${prompts.map((p: string) => `"${p}"`).join(", ")}`);
    }

    // Saved outfit count as a confidence signal
    const savedCount = (savedRows ?? []).length;
    if (savedCount > 0) {
      lines.push(`Saved outfits: ${savedCount} (these represent confirmed taste — prioritise similar aesthetics)`);
    }

    if (lines.length === 0) return null;
    return lines.join("\n");
  } catch (err) {
    console.warn("[generate] Style memory build failed (non-fatal):", err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse(req);

  try {
    // ── 1. AUTH ──
    const { user, error: authError } = await authenticateRequest(req);
    if (!user) return errorResponse(authError ?? "Unauthorized", 401);

    // ── 1a. RATE LIMIT ──
    if (!checkRateLimit(user.id, "generate")) {
      return rateLimitResponse(req);
    }

    const serviceClient = getServiceClient();

    // ── 1b. ATOMIC LIMIT CHECK + INCREMENT ──
    const genLimit = await checkAndIncrementGeneration(serviceClient, user.id);
    if (!genLimit.allowed) return limitResponse("generations", genLimit);

    // From this point, usage is pre-incremented. If we fail, rollback.
    let usageRolledBack = false;

    const { prompt, filters, session_id } = await req.json() as {
      prompt: string;
      filters: {
        budget_min: number;
        budget_max: number;
        gender: string;
        body_type?: string | null;
        age_range?: string | null;
        occasion?: string | null;
        season?: string | null;
      };
      session_id?: string;
    };

    if (!prompt?.trim()) {
      await rollbackUsage(serviceClient, user.id, "generations");
      return errorResponse("Prompt is required");
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      await rollbackUsage(serviceClient, user.id, "generations");
      return errorResponse(`Prompt too long (max ${MAX_PROMPT_LENGTH} characters)`);
    }

    // ── 2. FETCH USER CONTEXT (profile + currency) ──
    const { data: userProfile } = await serviceClient
      .from("users")
      .select("country, preferred_currency, gender_presentation, body_type, age_range, skin_tone, hair_colour, hair_length")
      .eq("id", user.id)
      .single();

    const userCountry: string = userProfile?.country ?? "";
    const userCurrency: string = (userProfile?.preferred_currency ?? "USD").toUpperCase();
    const currencySymbol = CURRENCY_SYMBOLS[userCurrency] ?? "$";

    // ── 2b. BUILD STYLE MEMORY ──
    const styleMemory = await buildStyleMemory(serviceClient, user.id, userProfile);

    // ── 3. LOAD ALL BRANDS (cheap — ~15 rows) ──
    const { data: brandsData } = await serviceClient
      .from("brands")
      .select("id, name, base_url");
    const brandMap = new Map<string, Brand>(
      (brandsData ?? []).map((b: Brand) => [b.id, b])
    );

    // ── 4. CREATE SESSION (if new) ──
    let currentSessionId = session_id;
    if (!currentSessionId) {
      const { data: sessionData, error: sessionError } = await serviceClient
        .from("outfit_sessions")
        .insert({ user_id: user.id, initial_prompt: prompt })
        .select("id")
        .single();

      if (sessionError) throw sessionError;
      currentSessionId = sessionData.id;
    }

    // ── 5. EMBED THE PROMPT ──
    const embeddingRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: prompt,
      }),
    });

    if (!embeddingRes.ok) {
      const errText = await embeddingRes.text();
      throw new Error(`Embedding failed: ${errText}`);
    }

    const embeddingJson = await embeddingRes.json();
    const queryVector = embeddingJson.data[0].embedding;

    // ── 6. VECTOR SEARCH ──
    // Budget filter: convert user's budget to USD for the RPC
    // (match_products compares raw price — we fetch more and filter ourselves)
    const genderFilter =
      filters.gender === "mens" ? "mens"
      : filters.gender === "womens" ? "womens"
      : "unisex";

    // Fetch more candidates than needed so we can post-filter by shipping
    const FETCH_COUNT = 60;

    let rawCandidates: Record<string, unknown>[] = [];

    if (genderFilter === "unisex") {
      const [womensRes, mensRes] = await Promise.all([
        serviceClient.rpc("match_products", {
          query_vector: queryVector,
          match_count: FETCH_COUNT,
          price_max: 9999999, // no price filter — we handle it ourselves
          price_min: 0,
          gender_filter: "womens",
        }),
        serviceClient.rpc("match_products", {
          query_vector: queryVector,
          match_count: FETCH_COUNT,
          price_max: 9999999,
          price_min: 0,
          gender_filter: "mens",
        }),
      ]);
      if (womensRes.error) throw womensRes.error;
      if (mensRes.error) throw mensRes.error;

      const merged = [...(womensRes.data ?? []), ...(mensRes.data ?? [])];
      const seen = new Set<string>();
      rawCandidates = merged
        .sort((a: { similarity?: number }, b: { similarity?: number }) =>
          (b.similarity ?? 0) - (a.similarity ?? 0)
        )
        .filter((p: { id?: string }) => {
          if (seen.has(p.id!)) return false;
          seen.add(p.id!);
          return true;
        });
    } else {
      const { data, error: searchError } = await serviceClient.rpc(
        "match_products",
        {
          query_vector: queryVector,
          match_count: FETCH_COUNT,
          price_max: 9999999,
          price_min: 0,
          gender_filter: genderFilter,
        }
      );
      if (searchError) throw searchError;
      rawCandidates = data ?? [];
    }

    // ── 6b. BACKFILL currency + brand_id (RPC may not return them) ──
    const candidateIds = rawCandidates.map((p) => p.id as string).filter(Boolean);
    if (candidateIds.length > 0) {
      const { data: productMeta } = await serviceClient
        .from("products")
        .select("id, currency, brand_id")
        .in("id", candidateIds);

      if (productMeta) {
        const metaMap = new Map(productMeta.map((m: { id: string; currency: string | null; brand_id: string | null }) => [m.id, m]));
        for (const p of rawCandidates) {
          const meta = metaMap.get(p.id as string);
          if (meta) {
            if (!p.currency) p.currency = meta.currency;
            if (!p.brand_id) p.brand_id = meta.brand_id;
          }
        }
      }
    }

    // ── 7. ENRICH CANDIDATES WITH CURRENCY + SHIPPING SCORE ──
    type EnrichedCandidate = Record<string, unknown> & {
      _currency: string;
      _price_usd: number;
      _display_price: number;
      _shipping_score: number;
    };

    const enriched: EnrichedCandidate[] = rawCandidates.map((p) => {
      const brandId = p.brand_id as string | undefined;
      const brand = brandId ? brandMap.get(brandId) : undefined;
      const baseUrl = brand?.base_url ?? null;

      // Resolve currency: product field → infer from brand URL → default GBP
      const rawCurrency = (p.currency as string | null) ?? null;
      const inferredCurrency = inferCurrencyFromUrl(baseUrl);
      const currency = (rawCurrency || inferredCurrency || "GBP").toUpperCase();

      const price = Number(p.price ?? 0);
      const priceUsd = convertCurrency(price, currency, "USD");
      const displayPrice = convertCurrency(price, currency, userCurrency);

      const shippingScore = userCountry
        ? brandShippingScore(baseUrl, userCountry)
        : 1;

      return {
        ...p,
        _currency: currency,
        _price_usd: priceUsd,
        _display_price: displayPrice,
        _shipping_score: shippingScore,
      };
    });

    // ── 8. FILTER BY SHIPPING + BUDGET ──
    // If user has a country set, exclude brands that won't ship there (score=0)
    let candidates = userCountry
      ? enriched.filter((p) => p._shipping_score > 0)
      : enriched;

    // Budget filter in user's currency
    if (filters.budget_max > 0) {
      candidates = candidates.filter(
        (p) => p._display_price <= filters.budget_max
      );
    }
    if (filters.budget_min > 0) {
      candidates = candidates.filter(
        (p) => p._display_price >= filters.budget_min
      );
    }

    // Sort: prioritise high shipping score, then similarity
    candidates.sort((a, b) => {
      if (b._shipping_score !== a._shipping_score) {
        return b._shipping_score - a._shipping_score;
      }
      return (b.similarity as number ?? 0) - (a.similarity as number ?? 0);
    });

    // Cap at 40 for GPT context
    candidates = candidates.slice(0, 40);

    if (candidates.length === 0) {
      return errorResponse(
        "No matching products found for your location and budget. Try broadening your filters.",
        422
      );
    }

    // ── 9. BUILD GPT CONTEXT ──
    // Show GPT the display_price in user's currency so it can respect budget
    const gptProducts = candidates.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand_name ?? p.brand_id,
      category: p.category_name ?? "",
      subcategory: p.subcategory ?? "",
      display_price: `${currencySymbol}${Number(p._display_price).toFixed(2)}`,
      original_currency: p._currency,
      colours: p.colours,
      style_tags: p.style_tags,
      occasion_tags: p.occasion_tags,
      fit: p.fit,
      description: p.description ?? "",
    }));

    const budgetStr = filters.budget_max
      ? `${currencySymbol}${filters.budget_max}`
      : "no limit";

    const chatRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: STYLIST_SYSTEM_PROMPT },
            {
              role: "user",
              content: `Styling brief: "${prompt}"
Budget: ${budgetStr} (currency: ${userCurrency})
User location: ${userCountry || "not specified"}${filters.body_type ? `\nBody type: ${filters.body_type}` : ""}${filters.age_range ? `\nAge range: ${filters.age_range}` : ""}${filters.occasion ? `\nOccasion: ${filters.occasion}` : ""}${filters.season ? `\nSeason: ${filters.season}` : ""}
${styleMemory ? `\n--- STYLE MEMORY (this user's taste profile) ---\n${styleMemory}\n--- END STYLE MEMORY ---\nUse the style memory to inform your choices — lean into the user's demonstrated preferences for brands, aesthetics, and colour palette while still honouring the current styling brief. Do NOT blindly copy past outfits; evolve the style.\n` : ""}
Available products:
${JSON.stringify(gptProducts, null, 2)}`,
            },
          ],
        }),
      }
    );

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      throw new Error(`GPT-4o failed: ${errText}`);
    }

    const chatJson = await chatRes.json();
    const rawContent = chatJson.choices[0].message.content;
    const parsed = JSON.parse(rawContent);
    const generatedOutfits: GeneratedOutfit[] = parsed.outfits ?? parsed;

    // ── 10. VALIDATE PRODUCT IDS ──
    const candidateMap = new Map(candidates.map((c) => [c.id as string, c]));

    for (const gen of generatedOutfits) {
      gen.items = gen.items.filter((item) => candidateMap.has(item.product_id));

      // Recalculate total_price ourselves (sum display prices in user's currency)
      // Never trust GPT's arithmetic
      gen.total_price = gen.items.reduce((sum, item) => {
        const candidate = candidateMap.get(item.product_id);
        return sum + (candidate ? Number(candidate._display_price) : 0);
      }, 0);
    }

    // ── 11. SAVE TO DATABASE ──
    const outfitIds: string[] = [];

    for (const gen of generatedOutfits) {
      if (gen.items.length === 0) continue;

      try {
        const { data: outfitRow, error: outfitError } = await serviceClient
          .from("outfits")
          .insert({
            session_id: currentSessionId,
            prompt_used: prompt,
            ai_reasoning: gen.reasoning,
            total_price: gen.total_price,
          })
          .select("id")
          .single();

        if (outfitError) {
          console.error("outfit insert error:", outfitError);
          continue;
        }

        outfitIds.push(outfitRow.id);

        const items = gen.items.map((item) => ({
          outfit_id: outfitRow.id,
          product_id: item.product_id,
          role: item.role,
        }));

        const { error: itemsError } = await serviceClient
          .from("outfit_items")
          .insert(items);

        if (itemsError) console.error("outfit_items insert error:", itemsError);
      } catch (err) {
        console.error("Error saving outfit:", err);
      }
    }

    if (outfitIds.length === 0) {
      throw new Error("Failed to save any outfits");
    }

    // ── 12. USAGE ALREADY PRE-INCREMENTED (step 1b) ──

    // ── 13. FETCH FULL PRODUCT DATA ──
    const { data: outfitRows, error: outfitFetchError } = await serviceClient
      .from("outfits")
      .select("*")
      .in("id", outfitIds);

    if (outfitFetchError) throw outfitFetchError;

    const { data: itemRows, error: itemFetchError } = await serviceClient
      .from("outfit_items")
      .select(
        `
        outfit_id, role,
        products (
          id, name, price, currency, images, colours, style_tags,
          occasion_tags, aesthetic_tags, fit, product_url,
          description, subcategory,
          brands ( name, base_url ),
          categories ( name )
        )
      `
      )
      .in("outfit_id", outfitIds);

    if (itemFetchError) throw itemFetchError;

    // ── 14. BUILD RESPONSE ──
    type ItemRow = {
      outfit_id: string;
      role: string;
      products: {
        id: string;
        name: string;
        price: number;
        currency: string | null;
        images: string[];
        colours: string[];
        style_tags: string[];
        occasion_tags: string[];
        aesthetic_tags: string[];
        fit: string | null;
        product_url: string | null;
        description: string | null;
        subcategory: string | null;
        brands?: { name: string; base_url: string | null };
        categories?: { name: string };
      };
    };

    const outfits = (outfitRows ?? []).map((o) => {
      const items = ((itemRows ?? []) as unknown as ItemRow[])
        .filter((item) => item.outfit_id === o.id && item.products)
        .map((item) => {
          const prod = item.products;
          const brandBaseUrl = prod.brands?.base_url ?? null;
          const rawCurr = prod.currency ?? null;
          const inferredCurr = inferCurrencyFromUrl(brandBaseUrl);
          const productCurrency = (rawCurr || inferredCurr || "GBP").toUpperCase();
          const displayPrice = convertCurrency(prod.price, productCurrency, userCurrency);

          return {
            product: {
              id: prod.id,
              name: prod.name,
              brand_name: prod.brands?.name ?? "Unknown",
              category_name: prod.categories?.name ?? "",
              subcategory: prod.subcategory,
              description: prod.description,
              price: displayPrice,
              currency: userCurrency,
              original_price: prod.price,
              original_currency: productCurrency,
              colours: prod.colours ?? [],
              images: prod.images ?? [],
              style_tags: prod.style_tags ?? [],
              occasion_tags: prod.occasion_tags ?? [],
              aesthetic_tags: prod.aesthetic_tags ?? [],
              fit: prod.fit,
              product_url: prod.product_url,
              similarity: 0,
            },
            role: item.role,
          };
        });

      // Recalculate total_price from actual converted per-item prices
      // (the DB value may have been calculated with incomplete currency data)
      const recalcTotal = items.reduce(
        (sum, item) => sum + (item.product.price ?? 0), 0
      );

      return { ...o, total_price: recalcTotal, items };
    });

    return jsonResponse({
      session_id: currentSessionId,
      outfits,
      currency: userCurrency,
    });
  } catch (err) {
    console.error("[generate]", err);
    // Rollback the pre-incremented usage on failure
    try {
      const { user: u } = await authenticateRequest(req);
      if (u) await rollbackUsage(getServiceClient(), u.id, "generations");
    } catch { /* best effort */ }
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500
    );
  }
});
