"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, LoaderCircle, Check, X } from "lucide-react";
import { displayDate } from "@/lib/dates";
import type { ChatReply } from "@/lib/ai/schema";
const prompts = [
  "What do I have due this week?",
  "Do I have anything overdue?",
  "Show my CSE tasks.",
  "What should I prioritize today?",
  "Summarize my workload by status and priority.",
  "Add a high-priority grading task called Moderate final scripts.",
  "Create a 10-mark quiz for CSE401 next week.",
];
type Message = {
  role: "user" | "assistant";
  text: string;
  tasks?: ChatReply["tasks"];
  actions?: ChatReply["actions"];
};
export function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<Message[] | null>(null);
  const lock = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy, error]);
  async function send(text: string, retry?: Message[]) {
    if (lock.current || !text.trim()) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setFailed(null);
    const next: Message[] = retry || [
      ...messages,
      { role: "user", text: text.trim() },
    ];
    setMessages(next);
    setDraft("");
    controller.current = new AbortController();
    try {
      const history = next
        .slice(0, -1)
        .slice(-6)
        .map(({ role, text }) => ({ role, text: text.slice(0, 1000) }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), history }),
        signal: AbortSignal.any([
          controller.current.signal,
          AbortSignal.timeout(50000),
        ]),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "The assistant could not respond. Please retry.",
        );
      setMessages([
        ...next,
        {
          role: "assistant",
          text: result.answer,
          tasks: result.tasks,
          actions: result.actions,
        },
      ]);
    } catch (error) {
      setError(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "The assistant took too long. Please retry.",
      );
      setFailed(next);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function decide(actionId: string, decision: "approve" | "cancel") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/chat/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_id: actionId, decision }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Action failed.");
      setMessages((current) => [
        ...current.map((message) => ({
          ...message,
          actions: message.actions?.filter((action) => action.id !== actionId),
        })),
        { role: "assistant", text: result.message },
      ]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Action failed.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="assistant-page">
      <div className="assistant-heading">
        <span className="brand-icon">
          <Sparkles size={24} />
        </span>
        <div>
          <h1>AI Assistant</h1>
          <p>A clearer view of your academic day.</p>
        </div>
      </div>
      <p className="assistant-caption">
        Ask about your workload, or tell me to add/delete a task, course, or
        quiz. Changes require your approval · Asia/Dhaka
      </p>
      <div className="assistant-prompts">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            disabled={busy}
            onClick={() => void send(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
      <section
        className="chat-log"
        role="log"
        aria-label="Assistant conversation"
        aria-live="polite"
        aria-busy={busy}
      >
        {!messages.length && (
          <div className="chat-empty">
            <Sparkles size={30} />
            <h2>Make room for what matters.</h2>
            <p>
              Choose a question above or ask your own. I’ll check your current
              tasks for each answer.
            </p>
          </div>
        )}
        {messages.map((message, index) => (
          <article key={index} className={`chat-message ${message.role}`}>
            <strong>{message.role === "user" ? "You" : "FacultyFlow"}</strong>
            <p>{message.text}</p>
            {!!message.tasks?.length && (
              <div className="chat-references">
                <small>Tasks retrieved for this answer</small>
                {message.tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks?q=${encodeURIComponent(task.title.slice(0, 120))}`}
                  >
                    <strong>{task.title}</strong>
                    <span>
                      {displayDate(task.due_at)} · {task.priority} ·{" "}
                      {task.status.replaceAll("_", " ")}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            {!!message.actions?.length && (
              <div className="chat-actions">
                {message.actions.map((action) => (
                  <div key={action.id}>
                    <strong>Approval required</strong>
                    <p>{action.summary}</p>
                    <small>
                      Expires {new Date(action.expires_at).toLocaleTimeString()}
                    </small>
                    <span>
                      <button
                        className="approve"
                        disabled={busy}
                        onClick={() => void decide(action.id, "approve")}
                      >
                        <Check size={15} /> Approve
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => void decide(action.id, "cancel")}
                      >
                        <X size={15} /> Cancel
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
        {busy && (
          <p className="chat-loading" role="status">
            <LoaderCircle size={18} /> Checking your tasks…
          </p>
        )}
        {error && (
          <div className="error" role="alert">
            <p>{error}</p>
            {failed && (
              <button
                className="secondary"
                onClick={() =>
                  void send(failed[failed.length - 1].text, failed)
                }
              >
                Retry
              </button>
            )}
          </div>
        )}
        <div ref={end} />
      </section>
      <form
        className="chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor="chat-message">Ask FacultyFlow</label>
        <div>
          <textarea
            id="chat-message"
            maxLength={2000}
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What should I focus on today?"
            disabled={busy}
          />
          <button
            className="primary"
            disabled={busy || !draft.trim()}
            type="submit"
          >
            <Send size={18} /> Send
          </button>
        </div>
        <small>
          Answers reflect tasks at the time of the request. Ask again after
          making changes.
        </small>
      </form>
    </main>
  );
}
