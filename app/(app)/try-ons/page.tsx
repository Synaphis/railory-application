import { createClient } from "@/lib/supabase/server";
import TryOnGallery from "./TryOnGallery";

export default async function TryOnsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch all outfits with preview images for this user
  const { data: outfitRows } = await supabase
    .from("outfits")
    .select(
      `
      id,
      session_id,
      preview_image,
      ai_reasoning,
      total_price,
      created_at,
      outfit_sessions!inner ( user_id, initial_prompt )
    `
    )
    .eq("outfit_sessions.user_id", user.id)
    .not("preview_image", "is", null)
    .order("created_at", { ascending: false });

  // Also list all files in the user's folder in outfit-previews bucket
  const { data: storageFiles } = await supabase.storage
    .from("outfit-previews")
    .list(user.id, { limit: 200, sortBy: { column: "created_at", order: "desc" } });

  // Build a map of outfit_id -> all image URLs from storage
  const imagesByOutfit: Record<string, string[]> = {};
  if (storageFiles) {
    for (const folder of storageFiles) {
      // Each folder is an outfit_id
      const { data: files } = await supabase.storage
        .from("outfit-previews")
        .list(`${user.id}/${folder.name}`, {
          limit: 50,
          sortBy: { column: "created_at", order: "desc" },
        });

      if (files && files.length > 0) {
        imagesByOutfit[folder.name] = files.map((f) => {
          const { data } = supabase.storage
            .from("outfit-previews")
            .getPublicUrl(`${user.id}/${folder.name}/${f.name}`);
          return data.publicUrl;
        });
      }
    }
  }

  type OutfitRow = {
    id: string;
    session_id: string;
    preview_image: string;
    ai_reasoning: string | null;
    total_price: number | null;
    created_at: string;
    outfit_sessions: { user_id: string; initial_prompt: string };
  };

  const galleryItems = (outfitRows ?? []).map((row) => {
    const o = row as unknown as OutfitRow;
    return {
      outfitId: o.id,
      sessionId: o.session_id,
      previewImage: o.preview_image,
      allImages: imagesByOutfit[o.id] ?? [o.preview_image],
      prompt: o.outfit_sessions?.initial_prompt ?? "",
      reasoning: o.ai_reasoning,
      createdAt: o.created_at,
    };
  });

  return <TryOnGallery items={galleryItems} />;
}
