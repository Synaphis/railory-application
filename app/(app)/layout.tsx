import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/TopBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="h-screen bg-canvas overflow-hidden">
      <TopBar userEmail={user.email ?? ""} />
      <main className="h-full pt-12 overflow-y-auto">{children}</main>
    </div>
  );
}
