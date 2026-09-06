"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import {
  assessmentFormSchema,
  questionSetSchema,
} from "@/lib/editor-validation";
const lines = (v: string) =>
  v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
async function send(type: string, body: unknown) {
  const r = await fetch("/api/faculty/editor" + type, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error);
  return data;
}
export function AssessmentEditor({
  items,
  course,
  refresh,
}: {
  items: any[];
  course: any;
  refresh: () => Promise<any>;
}) {
  const [draft, setDraft] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const start = (a?: any) => {
    setError("");
    setDraft(
      a
        ? {
            ...a,
            scheduled_on: String(a.scheduled_on).slice(0, 10),
            marks: Number(a.marks),
            weight_percent: Number(a.weight_percent),
          }
        : {
            course_id: course.id,
            title: "",
            kind: "quiz",
            scheduled_on: String(course.semester_start).slice(0, 10),
            marks: 10,
            weight_percent: 10,
            topics: [],
            clos: [],
            status: "draft",
          },
    );
  };
  const change = (key: string, value: any) =>
    setDraft({ ...draft, [key]: value });
  return (
    <section className="stack-form">
      <div className="card-actions">
        <h2>Assessments</h2>
        <button className="secondary" onClick={() => start()}>
          Add assessment
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {draft ? (
        <form
          key={draft.id || "new"}
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const input = assessmentFormSchema.parse(
                Object.fromEntries(
                  [
                    "course_id",
                    "id",
                    "title",
                    "kind",
                    "scheduled_on",
                    "marks",
                    "weight_percent",
                    "topics",
                    "clos",
                    "status",
                  ]
                    .filter((k) => draft[k] !== undefined)
                    .map((k) => [k, draft[k]]),
                ),
              );
              await send("", input);
              await refresh();
              setDraft(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Save failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Title
            <input
              required
              minLength={2}
              maxLength={160}
              value={draft.title}
              onChange={(e) => change("title", e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              Type
              <select
                value={draft.kind}
                onChange={(e) => change("kind", e.target.value)}
              >
                {["quiz", "midterm", "final"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                type="date"
                required
                min={String(course.semester_start).slice(0, 10)}
                max={String(course.semester_end).slice(0, 10)}
                value={draft.scheduled_on}
                onChange={(e) => change("scheduled_on", e.target.value)}
              />
            </label>
            {["marks", "weight_percent"].map((k) => (
              <label key={k}>
                {k === "marks" ? "Marks" : "Weight (%)"}
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  max={k === "marks" ? 1000 : 100}
                  value={draft[k]}
                  onChange={(e) => change(k, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <label>
            Topics (one per line)
            <textarea
              required
              defaultValue={draft.topics.join("\n")}
              onChange={(e) => change("topics", lines(e.target.value))}
            />
          </label>
          <label>
            CLOs (one per line)
            <textarea
              defaultValue={draft.clos.join("\n")}
              onChange={(e) => change("clos", lines(e.target.value))}
            />
          </label>
          <label>
            Status
            <select
              value={draft.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option>draft</option>
              <option>approved</option>
            </select>
          </label>
          <div className="card-actions">
            <button className="primary" disabled={busy}>
              Save / Update
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="result-grid">
          {items.map((a) => (
            <article className="result-card" key={a.id}>
              <strong>{a.title}</strong>
              <p>
                {a.kind} · {String(a.scheduled_on).slice(0, 10)} · {a.marks}{" "}
                marks · {a.weight_percent}% · {a.status}
              </p>
              <p>{a.topics.join(", ")}</p>
              <div className="card-actions">
                <button className="secondary" onClick={() => start(a)}>
                  Edit
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const r = await fetch("/api/faculty/editor?id=" + a.id, {
                        method: "DELETE",
                      });
                      if (!r.ok) throw new Error((await r.json()).error);
                      await refresh();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Delete failed.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
export function QuestionEditor({
  questions,
  courseId,
  assessments,
  refresh,
  initiallyOpen = false,
}: {
  questions: any[];
  courseId: string;
  assessments: any[];
  refresh: () => Promise<any>;
  initiallyOpen?: boolean;
}) {
  const [draft, setDraft] = useState<any[] | null>(
      initiallyOpen
        ? questions.map((q) => ({ ...q, marks: Number(q.marks) }))
        : null,
    ),
    [original, setOriginal] = useState<string[]>(
      initiallyOpen ? questions.map((q) => q.id) : [],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const action = async (q: any, mode: string) => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/faculty/questions", {
        method: mode === "regenerate" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "regenerate"
            ? {
                course_id: courseId,
                assessment_id: q.assessment_id,
                assessment_type: q.assessment_type,
                count: 1,
                marks_each: Number(q.marks),
                difficulty: q.difficulty,
                clo: q.clo,
              }
            : { id: q.id, status: mode === "approve" ? "approved" : "draft" },
        ),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  };
  const open = () => {
    setDraft(
      questions.map((q) => ({
        ...q,
        marks: Number(q.marks),
        options: q.options || [],
        answer: q.answer || "",
        question_type: q.question_type || "short_answer",
      })),
    );
    setOriginal(questions.map((q) => q.id));
    setError("");
  };
  const change = (i: number, k: string, v: any) =>
    setDraft(draft!.map((q, n) => (n === i ? { ...q, [k]: v } : q)));
  return (
    <section className="stack-form">
      <div className="card-actions">
        <h2>Saved questions</h2>
        <button className="secondary" onClick={open} disabled={draft !== null}>
          Edit / Add questions
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {draft !== null ? (
        <form
          className="stack-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const keys = [
                "id",
                "assessment_id",
                "question_text",
                "assessment_type",
                "marks",
                "difficulty",
                "clo",
                "question_type",
                "options",
                "answer",
              ];
              const input = questionSetSchema.parse({
                course_id: courseId,
                original_ids: original,
                questions: draft.map((q) =>
                  Object.fromEntries(
                    keys
                      .filter((k) => q[k] !== undefined)
                      .map((k) => [k, q[k]]),
                  ),
                ),
              });
              await send("?type=questions", input);
              await refresh();
              setDraft(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Save failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {draft.map((q, i) => (
            <fieldset className="stack-form" key={q.id || q.localKey}>
              <legend>Question {i + 1}</legend>
              <label>
                Question text
                <textarea
                  required
                  minLength={5}
                  maxLength={5000}
                  rows={4}
                  value={q.question_text}
                  onChange={(e) => change(i, "question_text", e.target.value)}
                />
              </label>
              <div className="form-grid">
                <label>
                  Marks
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    max="1000"
                    value={q.marks}
                    onChange={(e) => change(i, "marks", Number(e.target.value))}
                  />
                </label>
                {[
                  [
                    "question_type",
                    ["short_answer", "essay", "multiple_choice", "true_false"],
                  ],
                  ["difficulty", ["easy", "medium", "hard"]],
                  ["assessment_type", ["quiz", "midterm", "final"]],
                ].map(([key, values]) => (
                  <label key={String(key)}>
                    {String(key).replaceAll("_", " ")}
                    <select
                      value={q[String(key)]}
                      onChange={(e) => change(i, String(key), e.target.value)}
                    >
                      {(values as string[]).map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <label>
                Assessment
                <select
                  value={q.assessment_id || ""}
                  onChange={(e) =>
                    change(i, "assessment_id", e.target.value || null)
                  }
                >
                  <option value="">No linked assessment</option>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                CLO
                <input
                  maxLength={300}
                  value={q.clo}
                  onChange={(e) => change(i, "clo", e.target.value)}
                />
              </label>
              {q.question_type === "multiple_choice" && (
                <label>
                  Options (one per line)
                  <textarea
                    required
                    defaultValue={q.options.join("\n")}
                    onChange={(e) =>
                      change(i, "options", lines(e.target.value))
                    }
                  />
                </label>
              )}
              <label>
                Answer{" "}
                {q.question_type === "true_false" ? "(True or False)" : ""}
                <textarea
                  maxLength={5000}
                  value={q.answer}
                  onChange={(e) => change(i, "answer", e.target.value)}
                />
              </label>
              <div className="card-actions">
                {[-1, 1].map((offset) => (
                  <button
                    type="button"
                    className="secondary"
                    key={offset}
                    disabled={i + offset < 0 || i + offset >= draft.length}
                    onClick={() => {
                      const next = [...draft];
                      [next[i], next[i + offset]] = [next[i + offset], next[i]];
                      setDraft(next);
                    }}
                  >
                    {offset === -1 ? "Move up" : "Move down"}
                  </button>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setDraft(draft.filter((_, n) => n !== i))}
                >
                  Remove
                </button>
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setDraft([
                ...draft,
                {
                  localKey: crypto.randomUUID(),
                  assessment_id: null,
                  question_text: "",
                  assessment_type: "quiz",
                  marks: 5,
                  difficulty: "medium",
                  clo: "",
                  question_type: "short_answer",
                  options: [],
                  answer: "",
                },
              ])
            }
          >
            Add question
          </button>
          <div className="card-actions">
            <button className="primary" disabled={busy}>
              Save / Update questions
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="result-grid">
          {questions.map((q, i) => (
            <article className="result-card" key={q.id}>
              <strong>
                {i + 1}. {q.question_text}
              </strong>
              <p>
                {q.marks} marks · {q.difficulty} ·{" "}
                {q.question_type?.replaceAll("_", " ")} · {q.status}
              </p>
              {q.options?.map((v: string) => (
                <p key={v}>{v}</p>
              ))}
              {q.answer && <p>Answer: {q.answer}</p>}
              <small>
                {q.quality_pending
                  ? "Edited content: AI quality checks need to be rerun."
                  : `Relevance ${q.syllabus_relevance}% · Similarity ${q.previous_similarity}%`}
              </small>
              <div className="card-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => void action(q, "regenerate")}
                >
                  Regenerate
                </button>
                {q.quality_pending ? (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void action(q, "check")}
                  >
                    Run quality check
                  </button>
                ) : (
                  q.status !== "approved" && (
                    <button
                      type="button"
                      className="approve"
                      disabled={busy}
                      onClick={() => void action(q, "approve")}
                    >
                      Approve
                    </button>
                  )
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
