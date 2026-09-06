import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { Shell } from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const client = await serverClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  return (
    <Shell
      name={user.user_metadata.display_name || "Faculty member"}
      email={user.email || ""}
    >
      {children}
    </Shell>
  );
}
