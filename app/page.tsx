import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root of the app subdomain (app.railory.io).
 *
 * Unauthenticated users go to /login. Authenticated users go to /generate.
 * The marketing site (railory.io) is a separate Next.js project.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/generate");
  redirect("/login");
}
