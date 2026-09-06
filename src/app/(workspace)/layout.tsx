import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { ToastNotifications } from "@/components/toast-notifications";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  return (
    <Shell name={user.display_name} email={user.email} role={user.role}>
      {children}
      <ToastNotifications />
    </Shell>
  );
}
