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
    <div className="flex flex-col h-screen bg-canvas overflow-hidden">
      <TopBar userEmail={user.email ?? ""} />
      <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
    </div>
  );
}
