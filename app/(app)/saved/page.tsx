import { createClient } from "@/lib/supabase/server";
import SavedGrid from "./SavedGrid";
import type { RawSavedRow } from "./SavedGrid";

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: savedRows } = await supabase
    .from("saved_outfits")
    .select(
      `
      id,
      saved_at,
      notes,
      outfit_id,
      outfits (
        id, session_id, prompt_used, ai_reasoning, total_price, created_at,
        outfit_items (
          id, role,
          products (
            id, name, price, currency, images, colours, style_tags,
            occasion_tags, aesthetic_tags, fit, product_url,
            description, subcategory,
            brands ( name ),
            categories ( name )
          )
        )
      )
    `
    )
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false });

  return <SavedGrid savedRows={(savedRows ?? []) as unknown as RawSavedRow[]} />;
}
