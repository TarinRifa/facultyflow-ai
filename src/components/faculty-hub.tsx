"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { AssessmentEditor, QuestionEditor } from "./faculty-editors";
import {
  BookOpen,
  BrainCircuit,
  CalendarRange,
  FileSearch,
  LoaderCircle,
  Bell,
  WandSparkles,
  Plus,
  RefreshCw,
} from "lucide-react";

const features = [
  ["assignment", "Assignment analysis", FileSearch],
  ["planner", "Assessment planner", BookOpen],
  ["matching", "Previous questions", BrainCircuit],
  ["generator", "Question generator", WandSparkles],
  ["notifications", "Quiz heads-up", Bell],
  ["roadmap", "Course roadmap", CalendarRange],
] as const;
type Feature = (typeof features)[number][0];
const split = (value: string) =>
  value
    .split(/\n|,/)
    .map((v) => v.trim())
    .filter(Boolean);
export function FacultyHub() {
  const [data, setData] = useState<any>(null),
    [tab, setTab] = useState<Feature>("planner"),
    [courseId, setCourseId] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/faculty");
      const v = await r.json();
      if (!r.ok) throw new Error(v.error);
      setData(v);
      setCourseId((old: string) => old || v.courses[0]?.id || "");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load faculty workspace.",
      );
    }
  }, []);
  useEffect(() => {
    // Loading remote workspace state is the purpose of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  async function api(resource: string, options: RequestInit = {}) {
    setBusy(resource);
    setError("");
    setNotice("");
    try {
      const r = await fetch(
        resource ? `/api/faculty/${resource}` : "/api/faculty",
        options,
      );
      const v = r.status === 204 ? {} : await r.json();
      if (!r.ok) throw new Error(v.error || "Request failed.");
      await load();
      setNotice("Saved to your faculty workspace.");
      return v;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Request failed. Please retry.",
      );
      throw e;
    } finally {
      setBusy("");
    }
  }
  const course = data?.courses.find((c: any) => c.id === courseId),
    syllabus = data?.syllabi.find((s: any) => s.course_id === courseId),
    assessments =
      data?.assessments.filter((a: any) => a.course_id === courseId) || [],
    questions =
      data?.questions.filter((q: any) => q.course_id === courseId) || [];
  if (!data)
    return (
      <main className="faculty-page">
        <div className="loading-state">
          <LoaderCircle className="spin" />
          Loading faculty workspace…
        </div>
        {error && <p className="error">{error}</p>}
      </main>
    );
  return (
    <main className="faculty-page">
      <header className="faculty-header">
        <div>
          <span className="eyebrow">FACULTY INTELLIGENCE WORKSPACE</span>
          <h1>Assessments, with faculty in control.</h1>
          <p>
            Move from syllabus planning to approved questions through one
            connected workflow.
          </p>
        </div>
        <div className="faculty-course-picker">
          <label>
            Active course
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Select a course</option>
              {data.courses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      <CourseSetup data={data} api={api} />
      {!!course && (
        <>
          <nav className="faculty-tabs" aria-label="Faculty tools">
            {features.map(([id, label, Icon]) => (
              <button
                key={id}
                className={tab === id ? "selected" : ""}
                onClick={() => setTab(id)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
          {tab === "assignment" && (
            <Assignment
              courseId={courseId}
              analyses={data.analyses.filter(
                (a: any) => a.course_id === courseId,
              )}
              api={api}
              busy={busy}
            />
          )}
          {tab === "planner" && (
            <Planner
              course={course}
              syllabus={syllabus}
              assessments={assessments}
              routines={data.routines.filter(
                (r: any) => r.course_id === courseId,
              )}
              api={api}
              busy={busy}
            />
          )}
          {tab === "matching" && (
            <Matching
              courseId={courseId}
              papers={data.papers.filter((p: any) => p.course_id === courseId)}
              api={api}
              busy={busy}
            />
          )}
          {tab === "generator" && (
            <Generator
              courseId={courseId}
              assessments={assessments}
              questions={questions}
              syllabus={syllabus}
              api={api}
              busy={busy}
            />
          )}
          {tab === "notifications" && (
            <Notifications items={data.notifications} api={api} busy={busy} />
          )}
          {tab === "roadmap" && (
            <Roadmap
              items={data.roadmap}
              courses={data.courses}
              api={api}
              busy={busy}
            />
          )}
        </>
      )}
    </main>
  );
}
function CourseSetup({ data, api }: { data: any; api: any }) {
  const [open, setOpen] = useState(!data.courses.length);
  return (
    <section className="faculty-setup panel">
      <button className="section-toggle" onClick={() => setOpen(!open)}>
        <span>
          <strong>Courses & semester setup</strong>
          <small>
            {data.courses.length} course{data.courses.length === 1 ? "" : "s"}{" "}
            configured
          </small>
        </span>
        <Plus size={18} />
      </button>
      {open && (
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void api("courses", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: f.get("code"),
                title: f.get("title"),
                semester_start: f.get("start"),
                semester_end: f.get("end"),
              }),
            }).then(() => {
              e.currentTarget.reset();
              setOpen(false);
            });
          }}
        >
          <label>
            Course code
            <input
              name="code"
              required
              minLength={2}
              maxLength={30}
              placeholder="CSE101"
            />
          </label>
          <label>
            Course title
            <input name="title" required minLength={2} maxLength={160} />
          </label>
          <label>
            Semester starts
            <input name="start" type="date" required />
          </label>
          <label>
            Semester ends
            <input name="end" type="date" required />
          </label>
          <button className="primary" type="submit">
            Add course
          </button>
        </form>
      )}
    </section>
  );
}
function Assignment({
  courseId,
  analyses,
  api,
  busy,
}: {
  courseId: string;
  analyses: any[];
  api: any;
  busy: string;
}) {
  return (
    <FeaturePanel
      title="Assignment AI analysis"
      intro="Upload student work for an AI-writing indicator and semantic comparison with earlier submissions in this course."
    >
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          form.set("course_id", courseId);
          void api("assignments", { method: "POST", body: form }).then(() =>
            e.currentTarget.reset(),
          );
        }}
      >
        <label>
          Assignment file (PDF, DOCX, TXT; max 8 MB)
          <input
            name="file"
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            required
          />
        </label>
        <button className="primary" disabled={busy === "assignments"}>
          {busy === "assignments" ? "Analyzing…" : "Analyze assignment"}
        </button>
      </form>
      <p className="ai-disclaimer">
        AI-writing likelihood is an indicator, not definitive proof. Review
        context and flagged passages before making a decision.
      </p>
      <div className="result-grid">
        {analyses.map((a) => (
          <article className="result-card" key={a.id}>
            <div className="metric-row">
              <strong>{a.filename}</strong>
              <span>{a.ai_likelihood}% AI indicator</span>
              <span>{a.similarity_percent}% similarity</span>
            </div>
            {a.flags?.map((f: any, i: number) => (
              <blockquote key={i}>
                <mark>{f.excerpt}</mark>
                <small>{f.reason}</small>
              </blockquote>
            ))}
          </article>
        ))}
      </div>
    </FeaturePanel>
  );
}
function Planner({
  course,
  syllabus,
  assessments,
  routines,
  api,
  busy,
}: {
  course: any;
  syllabus: any;
  assessments: any[];
  routines: any[];
  api: any;
  busy: string;
}) {
  const [fileMode, setFileMode] = useState(false);
  return (
    <FeaturePanel
      title="Syllabus → assessment planner"
      intro={`Semester: ${String(course.semester_start).slice(0, 10)} to ${String(course.semester_end).slice(0, 10)}. AI drafts remain editable until you approve them.`}
    >
      <div className="two-column">
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const payload = {
              course_id: course.id,
              content: f.get("content"),
              source_name: "Manual entry",
              clos: split(String(f.get("clos"))),
              topics: split(String(f.get("topics"))),
              progress_percent: Number(f.get("progress")),
            };
            if (fileMode) {
              const fd = new FormData();
              fd.set("course_id", course.id);
              fd.set("file", f.get("file")!);
              fd.set("clos", JSON.stringify(payload.clos));
              fd.set("topics", JSON.stringify(payload.topics));
              fd.set("progress_percent", String(payload.progress_percent));
              void api("syllabus", { method: "POST", body: fd });
            } else
              void api("syllabus", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
          }}
        >
          <div className="form-title">
            <strong>Syllabus & progress</strong>
            <button
              type="button"
              className="text-link"
              onClick={() => setFileMode(!fileMode)}
            >
              {fileMode ? "Enter text" : "Upload file"}
            </button>
          </div>
          {fileMode ? (
            <label>
              Syllabus file
              <input
                name="file"
                type="file"
                accept=".pdf,.docx,.txt"
                required
              />
            </label>
          ) : (
            <label>
              Syllabus content
              <textarea
                name="content"
                rows={6}
                required
                minLength={20}
                defaultValue={syllabus?.content || ""}
              />
            </label>
          )}
          <label>
            CLOs (one per line)
            <textarea
              name="clos"
              rows={3}
              defaultValue={syllabus?.clos?.join("\n") || ""}
            />
          </label>
          <label>
            Topics (one per line)
            <textarea
              name="topics"
              rows={4}
              required
              defaultValue={syllabus?.topics?.join("\n") || ""}
            />
          </label>
          <label>
            Completed syllabus:{" "}
            <output>{syllabus?.progress_percent || 0}%</output>
            <input
              name="progress"
              type="range"
              min="0"
              max="100"
              defaultValue={syllabus?.progress_percent || 0}
            />
          </label>
          <button className="secondary">Save syllabus</button>
        </form>
        <div className="stack-form">
          <Routine courseId={course.id} routines={routines} api={api} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void api("plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  course_id: course.id,
                  quiz_count: Number(f.get("quizzes")),
                  include_midterm: f.get("midterm") === "on",
                  include_final: f.get("final") === "on",
                }),
              });
            }}
          >
            <strong>Generate plan</strong>
            <label>
              Number of quizzes
              <input
                name="quizzes"
                type="number"
                min="0"
                max="12"
                defaultValue="2"
                required
              />
            </label>
            <div className="check-row">
              <label>
                <input name="midterm" type="checkbox" defaultChecked /> Midterm
              </label>
              <label>
                <input name="final" type="checkbox" defaultChecked /> Final
              </label>
            </div>
            <button className="primary" disabled={busy === "plans"}>
              <RefreshCw size={16} />
              {assessments.length ? "Regenerate drafts" : "Generate AI plan"}
            </button>
          </form>
        </div>
      </div>
      <AssessmentEditor
        key={course.id}
        items={assessments}
        course={course}
        refresh={() => api("")}
      />
    </FeaturePanel>
  );
}
function Routine({
  courseId,
  routines,
  api,
}: {
  courseId: string;
  routines: any[];
  api: any;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void api("routines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: courseId,
            weekday: Number(f.get("weekday")),
            start_time: f.get("start"),
            end_time: f.get("end"),
            room: f.get("room"),
          }),
        });
      }}
    >
      <strong>Class routine</strong>
      <div className="compact-grid">
        <select name="weekday" aria-label="Weekday">
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((v, i) => (
            <option value={i} key={v}>
              {v}
            </option>
          ))}
        </select>
        <input aria-label="Class start" name="start" type="time" required />
        <input aria-label="Class end" name="end" type="time" required />
        <input aria-label="Room" name="room" placeholder="Room" />
        <button className="secondary">Add</button>
      </div>
      {routines.map((r) => (
        <small key={r.id}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][r.weekday]}{" "}
          {String(r.start_time).slice(0, 5)}–{String(r.end_time).slice(0, 5)}{" "}
          {r.room}
        </small>
      ))}
    </form>
  );
}
function Matching({
  courseId,
  papers,
  api,
  busy,
}: {
  courseId: string;
  papers: any[];
  api: any;
  busy: string;
}) {
  const [matches, setMatches] = useState<any[]>([]);
  return (
    <FeaturePanel
      title="Previous-year question matching"
      intro="Questions are embedded and compared semantically across different years. Scores indicate textual meaning overlap."
    >
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          f.set("course_id", courseId);
          void api("previous-papers", { method: "POST", body: f }).then(() =>
            e.currentTarget.reset(),
          );
        }}
      >
        <label>
          Question paper
          <input name="file" type="file" accept=".pdf,.docx,.txt" required />
        </label>
        <label>
          Year
          <input
            name="year"
            type="number"
            min="1990"
            max="2100"
            defaultValue={new Date().getFullYear() - 1}
            required
          />
        </label>
        <button className="primary" disabled={busy === "previous-papers"}>
          Upload & embed
        </button>
      </form>
      <div className="chip-row">
        {papers.map((p) => (
          <span key={p.id}>
            {p.year} · {p.filename} · {p.question_count} questions
          </span>
        ))}
      </div>
      <button
        className="secondary"
        disabled={!papers.length}
        onClick={async () => {
          setBusySafe();
          const r = await fetch(
            `/api/faculty/previous-matches?course_id=${courseId}`,
          );
          const v = await r.json();
          if (r.ok) setMatches(v.matches);
        }}
      >
        Compare all years
      </button>
      <div className="result-grid">
        {matches.map((m) => (
          <article
            className={`result-card ${m.highly_repeated ? "flagged" : ""}`}
            key={m.id}
          >
            <strong>
              {m.year}: {m.question}
            </strong>
            <p>
              {m.similarity}% match with {m.matched_year || "no other year"}
            </p>
            {m.matched_question && (
              <blockquote>{m.matched_question}</blockquote>
            )}
            {m.highly_repeated && (
              <span className="status-pill warning">Highly repeated</span>
            )}
          </article>
        ))}
      </div>
    </FeaturePanel>
  );
  function setBusySafe() {
    setMatches([]);
  }
}
function Generator({
  courseId,
  assessments,
  questions,
  syllabus,
  api,
  busy,
}: {
  courseId: string;
  assessments: any[];
  questions: any[];
  syllabus: any;
  api: any;
  busy: string;
}) {
  const [editorVersion, setEditorVersion] = useState(0);
  return (
    <FeaturePanel
      title="AI question generator"
      intro="Questions use syllabus progress, CLOs and prior papers, then receive relevance and similarity checks before faculty approval."
    >
      {!syllabus && <p className="warning-box">Save a syllabus first.</p>}
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void api("questions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              course_id: courseId,
              assessment_id: f.get("assessment") || null,
              assessment_type: f.get("type"),
              count: Number(f.get("count")),
              marks_each: Number(f.get("marks")),
              difficulty: f.get("difficulty"),
              clo: f.get("clo"),
            }),
          })
            .then(() => setEditorVersion((v) => v + 1))
            .catch(() => {});
        }}
      >
        <label>
          Assessment
          <select name="assessment">
            <option value="">No linked assessment</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select name="type">
            <option>quiz</option>
            <option>midterm</option>
            <option>final</option>
          </select>
        </label>
        <label>
          Difficulty
          <select name="difficulty">
            <option>easy</option>
            <option>medium</option>
            <option>hard</option>
          </select>
        </label>
        <label>
          Questions
          <input
            name="count"
            type="number"
            min="1"
            max="20"
            defaultValue="3"
            required
          />
        </label>
        <label>
          Marks each
          <input
            name="marks"
            type="number"
            min="1"
            max="1000"
            defaultValue="5"
            required
          />
        </label>
        <label>
          CLO
          <input
            name="clo"
            maxLength={300}
            placeholder={syllabus?.clos?.[0] || "CLO1"}
          />
        </label>
        <button className="primary" disabled={busy === "questions"}>
          Generate & quality-check
        </button>
      </form>
      <QuestionEditor
        key={courseId + ":" + editorVersion}
        initiallyOpen={editorVersion > 0}
        questions={questions}
        courseId={courseId}
        assessments={assessments}
        refresh={() => api("")}
      />
    </FeaturePanel>
  );
}
function Notifications({
  items,
  api,
  busy,
}: {
  items: any[];
  api: any;
  busy: string;
}) {
  return (
    <FeaturePanel
      title="Quiz heads-up"
      intro="Countdowns, low readiness, incomplete coverage and date conflicts are stored with read status."
    >
      <button
        className="primary"
        disabled={busy === "notifications"}
        onClick={() => void api("notifications", { method: "POST" })}
      >
        <RefreshCw size={16} />
        Refresh alerts
      </button>
      <div className="result-grid">
        {items.map((n) => (
          <article
            className={`result-card notification ${n.severity} ${n.is_read ? "read" : ""}`}
            key={n.id}
          >
            <div className="card-top">
              <span className="status-pill">{n.severity}</span>
              <strong>{n.title}</strong>
            </div>
            <p>{n.message}</p>
            <button
              className="text-link"
              onClick={() =>
                void api("notifications", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: n.id, is_read: !n.is_read }),
                })
              }
            >
              Mark {n.is_read ? "unread" : "read"}
            </button>
          </article>
        ))}
      </div>
    </FeaturePanel>
  );
}
function Roadmap({
  items,
  courses,
  api,
  busy,
}: {
  items: any[];
  courses: any[];
  api: any;
  busy: string;
}) {
  return (
    <FeaturePanel
      title="AI multi-course assessment roadmap"
      intro="Recommendations combine all courses, routines, syllabus progress and assessment dates, then explain each suggested date."
    >
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void api("roadmap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ horizon_days: Number(f.get("horizon")) }),
          });
        }}
      >
        <label>
          Planning horizon
          <select name="horizon">
            <option value="30">30 days</option>
            <option value="60">60 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
        <button className="primary" disabled={busy === "roadmap"}>
          <RefreshCw size={16} />
          {items.length ? "Recalculate roadmap" : "Build roadmap"}
        </button>
      </form>
      <p>
        {courses.length} courses included. Recalculate after changing syllabus
        progress or assessments.
      </p>
      <div className="roadmap-list">
        {items.map((i) => (
          <article key={i.id}>
            <time>{String(i.recommended_on).slice(0, 10)}</time>
            <div>
              <strong>
                {i.code} · {i.assessment_title}
              </strong>
              <p>{i.rationale}</p>
              {i.conflicts?.length > 0 && (
                <small>Conflicts: {i.conflicts.join(", ")}</small>
              )}
            </div>
            <span>{Math.round(i.score)} fit</span>
          </article>
        ))}
      </div>
    </FeaturePanel>
  );
}
function FeaturePanel({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <section className="faculty-feature panel">
      <header>
        <h2>{title}</h2>
        <p>{intro}</p>
      </header>
      {children}
    </section>
  );
}
