import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { AcademicSettings } from "@/components/academic-settings";

export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  return <AcademicSettings />;
}
