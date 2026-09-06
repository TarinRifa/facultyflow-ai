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
} from "lucide-react";
import { useState } from "react";
export function Shell({
  children,
  name,
  email,
}: {
  children: React.ReactNode;
  name: string;
  email: string;
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
        <Link href="/dashboard" className="brand">
          <span className="brand-icon">
            <GraduationCap size={23} />
          </span>
          FacultyFlow<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">F</span>
          <div>
            <strong>Faculty workspace</strong>
            <small>Personal space</small>
          </div>
          <PanelLeftClose size={16} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <Link
            aria-current={path === "/dashboard" ? "page" : undefined}
            className={path === "/dashboard" ? "nav-item active" : "nav-item"}
            href="/dashboard"
          >
            <LayoutDashboard size={19} />
            Overview
          </Link>
          <Link
            aria-current={path === "/tasks" ? "page" : undefined}
            className={path === "/tasks" ? "nav-item active" : "nav-item"}
            href="/tasks"
          >
            <ListTodo size={19} />
            My tasks
          </Link>
        </nav>
        <div className="sidebar-note">
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
        </div>
        <div className="account">
          <span className="avatar">{name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <small title={email}>{email}</small>
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
            <strong>{path === "/tasks" ? "My tasks" : "Overview"}</strong>
          </span>
          <div className="topbar-right">
            <span className="private-dot" />
            Personal workspace
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
