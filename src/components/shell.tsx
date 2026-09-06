"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  LayoutDashboard,
  ListTodo,
  ArrowUpRight,
  LogOut,
  Sparkles,
  PanelLeftClose,
  BookOpenCheck,
  ShieldCheck,
  Settings2,
} from "lucide-react";
import { useState } from "react";
export function Shell({
  children,
  name,
  email,
  role,
}: {
  children: React.ReactNode;
  name: string;
  email: string;
  role: "admin" | "faculty";
}) {
  const path = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  async function logout() {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) {
      setError("Could not sign out. Please retry.");
      return;
    }
    router.push("/login");
    router.refresh();
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href={role === "admin" ? "/admin" : "/dashboard"} className="brand">
          <span className="brand-icon">
            <GraduationCap size={23} />
          </span>
          FacultyFlow<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">F</span>
          <div>
            <strong>{role === "admin" ? "Admin workspace" : "Faculty workspace"}</strong>
            <small>{role === "admin" ? "Administration" : "Personal space"}</small>
          </div>
          <PanelLeftClose size={16} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {role === "faculty" && <>
          <Link
            aria-current={path === "/dashboard" ? "page" : undefined}
            className={path === "/dashboard" ? "nav-item active" : "nav-item"}
            href="/dashboard"
          >
            <LayoutDashboard size={19} />
            Overview
          </Link>
          <Link
            aria-current={path === "/faculty" ? "page" : undefined}
            className={path === "/faculty" ? "nav-item active" : "nav-item"}
            href="/faculty"
          >
            <BookOpenCheck size={19} />
            Faculty tools
          </Link>
          <Link
            aria-current={path === "/tasks" ? "page" : undefined}
            className={path === "/tasks" ? "nav-item active" : "nav-item"}
            href="/tasks"
          >
            <ListTodo size={19} />
            My tasks
          </Link>
          <Link
            aria-current={path === "/assistant" ? "page" : undefined}
            className={path === "/assistant" ? "nav-item active" : "nav-item"}
            href="/assistant"
          >
            <Sparkles size={19} />
            AI Assistant
          </Link>
          </>}
          {role === "admin" && (
            <>
              <Link href="/admin" className={path === "/admin" ? "nav-item active" : "nav-item"} aria-current={path === "/admin" ? "page" : undefined}>
                <LayoutDashboard size={19} />Dashboard
              </Link>
              <Link
                aria-current={path === "/admin/users" ? "page" : undefined}
                className={path === "/admin/users" ? "nav-item active" : "nav-item"}
                href="/admin/users"
              >
                <ShieldCheck size={19} />
                Manage users
              </Link>
              <Link
                aria-current={path === "/admin/settings" ? "page" : undefined}
                className={path === "/admin/settings" ? "nav-item active" : "nav-item"}
                href="/admin/settings"
              >
                <Settings2 size={19} />
                Academic settings
              </Link>
            </>
          )}
        </nav>
        {role === "faculty" && <div className="sidebar-note">
          <span className="note-icon">
            <Sparkles size={19} />
          </span>
          <h3>A little more headspace.</h3>
          <p>
            Organize the details.
            <br />
            Focus on the bigger picture.
          </p>
          <Link href="/tasks">
            Plan your day <ArrowUpRight size={15} />
          </Link>
        </div>}
        <div className="account">
          <span className="avatar">{name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <small title={email}>{email}</small>
            {role === "admin" && <small className="account-role">Administrator</small>}
          </div>
          <button
            className="icon-button"
            onClick={logout}
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </aside>
      <div className="main-area">
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb">/</span>{" "}
            <strong>
              {path === "/tasks"
                ? "My tasks"
                : path === "/assistant"
                  ? "AI Assistant"
                  : path === "/faculty"
                    ? "Faculty tools"
                    : path === "/admin/users"
                      ? "Manage users"
                      : path === "/admin/settings"
                        ? "Academic settings"
                    : "Overview"}
            </strong>
          </span>
          <div className="topbar-right">
            <span className="private-dot" />
            {role === "admin" ? "Admin workspace" : "Personal workspace"}
            <span className="avatar small">{name.charAt(0).toUpperCase()}</span>
          </div>
        </header>
        {children}
        <footer className="footer">
          A little clarity goes a long way.
          <span>FacultyFlow · Made for academic life</span>
        </footer>
      </div>
    </div>
  );
}
