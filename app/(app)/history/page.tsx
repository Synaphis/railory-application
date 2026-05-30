import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import HistoryList from "./HistoryList";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: sessions } = await supabase
    .from("outfit_sessions")
    .select(
      `
      *,
      outfits ( count )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <Suspense fallback={null}>
      <HistoryList sessions={sessions ?? []} />
    </Suspense>
  );
}
