import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/dashboard");
  return (
    <main className="workspace-content admin-page">
      <header className="page-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>Admin dashboard</h1><p>Manage accounts and institutional academic settings.</p></div></header>
      <div className="two-column">
        <Link href="/admin/users" className="stat-card"><h2>Manage users</h2><p>Create administrators and promote faculty accounts.</p></Link>
        <Link href="/admin/settings" className="stat-card"><h2>Academic settings</h2><p>Set semester dates and assessment and academic rules.</p></Link>
      </div>
    </main>
  );
}
