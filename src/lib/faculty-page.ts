import "server-only";
import { currentUser } from "./auth";
import { redirect } from "next/navigation";

export async function requireFacultyPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "admin") redirect("/admin");
  return user;
}
