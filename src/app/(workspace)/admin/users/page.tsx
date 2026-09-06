import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { ManageUsers } from "@/components/manage-users";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  return <ManageUsers />;
}
