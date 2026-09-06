"use client";
import { appFetch } from "@/lib/client-api";
import { useEffect, useState } from "react";
import { LoaderCircle, Save } from "lucide-react";

type Settings = {
  semester_start: string;
  semester_end: string;
  assessment_rules: string;
  academic_rules: string;
};
const date = (value: string) => String(value).slice(0, 10);

export function AcademicSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    appFetch("/api/admin/settings", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setSettings({
          ...data.settings,
          semester_start: date(data.settings.semester_start),
          semester_end: date(data.settings.semester_end),
        });
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Could not load settings.",
        ),
      );
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setError("");
    setSaved("");
    if (settings.semester_end <= settings.semester_start) {
      setError("Semester end must be after its start.");
      return;
    }
    setBusy(true);
    try {
      const response = await appFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSettings({
        ...data.settings,
        semester_start: date(data.settings.semester_start),
        semester_end: date(data.settings.semester_end),
      });
      setSaved(
        "Academic settings saved. New planner and roadmap runs will use them.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save settings.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace-content admin-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>
            Academic settings<span className="heading-dot">.</span>
          </h1>
          <p>
            These dates and rules guide every new AI assessment plan and course
            roadmap.
          </p>
        </div>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="success" role="status">
          {saved}
        </p>
      )}
      {settings && (
        <form className="panel admin-settings-form" onSubmit={submit}>
          <div className="form-grid settings-dates">
            <label>
              Semester start
              <input
                type="date"
                required
                value={settings.semester_start}
                onChange={(e) =>
                  setSettings({ ...settings, semester_start: e.target.value })
                }
              />
            </label>
            <label>
              Semester end
              <input
                type="date"
                required
                min={settings.semester_start}
                value={settings.semester_end}
                onChange={(e) =>
                  setSettings({ ...settings, semester_end: e.target.value })
                }
              />
            </label>
          </div>
          <label>
            Assessment rules
            <textarea
              rows={6}
              maxLength={10000}
              value={settings.assessment_rules}
              onChange={(e) =>
                setSettings({ ...settings, assessment_rules: e.target.value })
              }
            />
          </label>
          <label>
            Academic rules
            <textarea
              rows={6}
              maxLength={10000}
              value={settings.academic_rules}
              onChange={(e) =>
                setSettings({ ...settings, academic_rules: e.target.value })
              }
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Save size={17} />
            )}{" "}
            Save settings
          </button>
        </form>
      )}
    </main>
  );
}
