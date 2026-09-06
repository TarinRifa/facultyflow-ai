"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  GraduationCap,
  LoaderCircle,
} from "lucide-react";
import { browserClient } from "@/lib/supabase/browser";
export function Login() {
  const router = useRouter();
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const values = new FormData(event.currentTarget);
    try {
      const client = browserClient();
      if (signup) {
        const { data, error } = await client.auth.signUp({
          email: String(values.get("email")),
          password: String(values.get("password")),
          options: {
            data: { display_name: String(values.get("name")) },
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/dashboard");
          router.refresh();
          return;
        }
        setMessage("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: String(values.get("email")),
          password: String(values.get("password")),
        });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
        return;
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to sign in. Please try again.",
      );
    }
    setBusy(false);
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <GraduationCap size={23} />
          </span>
          FacultyFlow<span className="brand-dot">.</span>
        </Link>
        <div>
          <span className="eyebrow">A LITTLE STRUCTURE. A LOT MORE FOCUS.</span>
          <h1>
            Your work matters.
            <br />
            <em>Make room for it.</em>
          </h1>
          <p>
            One thoughtful space for your teaching, research, and everything in
            between.
          </p>
          <div className="story-card">
            <span className="story-icon">
              <BookOpen />
            </span>
            <div>
              <strong>
                Less keeping track.
                <br />
                More moving forward.
              </strong>
              <p>A clearer view of your academic day.</p>
            </div>
            <span className="check-orbit">
              <Check size={20} />
            </span>
          </div>
        </div>
        <small>Built for the people shaping what comes next.</small>
      </section>
      <section className="login-form-side">
        <div className="login-form">
          <span className="eyebrow">YOUR FACULTY WORKSPACE</span>
          <h2>{signup ? "Start with a little clarity." : "Welcome back."}</h2>
          <p className="muted">
            {signup
              ? "Create your account and organize your first task."
              : "A fresh perspective on everything on your plate."}
          </p>
          <form onSubmit={submit}>
            {signup && (
              <label>
                Full name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={100}
                  placeholder="Dr. Alex Morgan"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@university.edu"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={8}
                required
                placeholder="At least 8 characters"
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="success" role="status">
                {message}
              </p>
            )}
            <button className="primary login-submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <>
                  {signup ? "Create account" : "Sign in"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <p className="switch-auth">
            {signup ? "Already have an account?" : "New to FacultyFlow?"}{" "}
            <button
              onClick={() => {
                setSignup(!signup);
                setError("");
                setMessage("");
              }}
            >
              {signup ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="login-note">Your tasks stay private to your account.</p>
        </div>
      </section>
    </main>
  );
}
