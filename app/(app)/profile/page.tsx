import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select(
      "full_name, email, custom_avatar_url, height_cm, weight_kg, body_type, gender_presentation, skin_tone, hair_colour, hair_length, age_range, country, preferred_currency"
    )
    .eq("id", user.id)
    .single();

  // custom_avatar_url stores a path — resolve to signed URL for display
  if (profile?.custom_avatar_url) {
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: signedData } = await serviceSupabase.storage
      .from("user-avatars")
      .createSignedUrl(profile.custom_avatar_url, 60 * 60);

    profile.custom_avatar_url = signedData?.signedUrl ?? null;
  }

  return <ProfileForm profile={profile} />;
}
