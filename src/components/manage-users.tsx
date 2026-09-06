"use client";
import { useEffect, useState } from "react";
import { LoaderCircle, Plus, ShieldCheck, UserRound } from "lucide-react";

type Account = {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "faculty";
  created_at: string;
};

export function ManageUsers() {
  const [users, setUsers] = useState<Account[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/users", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setUsers(data.users);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load users."));
  }, []);

  async function promote(user: Account) {
    setBusy(user.id);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUsers((current) => current.map((item) => item.id === user.id ? data.user : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not promote this user.");
    } finally {
      setBusy("");
    }
  }

  async function addAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy("create");
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: String(values.get("display_name")),
          email: String(values.get("email")),
          password: String(values.get("password")),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUsers((current) => [...current, data.user]);
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the administrator.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="workspace-content admin-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>Manage users<span className="heading-dot">.</span></h1>
          <p>Faculty accounts can only become administrators through this protected page.</p>
        </div>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      <form className="panel admin-create-form" onSubmit={addAdmin}>
        <div>
          <strong>Create administrator</strong>
          <small>Create login credentials for another administrator.</small>
        </div>
        <label>Full name<input name="display_name" required minLength={2} maxLength={100} /></label>
        <label>Email<input name="email" type="email" required maxLength={254} /></label>
        <label>Password<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" /></label>
        <button className="primary" disabled={busy === "create"}>
          {busy === "create" ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Add admin
        </button>
      </form>
      <section className="panel admin-panel">
        <div className="admin-user-list">
          {users.map((user) => (
            <article className="admin-user-row" key={user.id}>
              <span className="admin-user-icon"><UserRound size={18} /></span>
              <div>
                <strong>{user.display_name}</strong>
                <small>{user.email}</small>
              </div>
              <span className={`role-badge ${user.role}`}>
                {user.role === "admin" && <ShieldCheck size={13} />}{user.role}
              </span>
              {user.role === "faculty" && (
                <button className="approve" disabled={busy === user.id} onClick={() => void promote(user)}>
                  {busy === user.id ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}
                  Make Admin
                </button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
