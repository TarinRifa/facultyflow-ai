"use client";
import { useEffect, useState } from "react";
import { appFetch } from "@/lib/client-api";
import { displayDate } from "@/lib/dates";
type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_at: string | null;
  course_code: string;
};
export function ChatTaskPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (id: string) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    appFetch(
      "/api/tasks?" +
        new URLSearchParams({
          q: search,
          page: String(page),
          limit: "10",
          sort: "updated",
        }),
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (!controller.signal.aborted) {
          setTasks(data.tasks);
          setTotal(data.total);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load tasks.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, search, refresh]);
  return (
    <div className="stack-form">
      <strong>Choose a task to delete</strong>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setPage(1);
          setSearch(query);
          setRefresh((v) => v + 1);
        }}
      >
        <label>
          Search your tasks
          <input
            value={query}
            maxLength={120}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="secondary" disabled={disabled}>
          Search
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading current tasks…</p>
      ) : !tasks.length ? (
        <p>No current tasks match.</p>
      ) : (
        tasks.map((task) => (
          <div className="result-card" key={task.id}>
            <strong>{task.title}</strong>
            <p>
              {task.course_code} · {task.priority} ·{" "}
              {task.status.replaceAll("_", " ")} · {displayDate(task.due_at)}
            </p>
            <button
              type="button"
              className="secondary"
              disabled={disabled}
              onClick={() => onSelect(task.id)}
            >
              Select this task
            </button>
          </div>
        ))
      )}
      <div className="card-actions">
        <button
          type="button"
          className="secondary"
          disabled={disabled || loading || page === 1}
          onClick={() => {
            setLoading(true);
            setPage((v) => v - 1);
          }}
        >
          Previous
        </button>
        <small>
          Page {page} · {total} tasks
        </small>
        <button
          type="button"
          className="secondary"
          disabled={disabled || loading || page * 10 >= total}
          onClick={() => {
            setLoading(true);
            setPage((v) => v + 1);
          }}
        >
          Next
        </button>
        <button
          type="button"
          className="secondary"
          disabled={disabled || loading}
          onClick={() => {
            setLoading(true);
            setRefresh((v) => v + 1);
          }}
        >
          Refresh list
        </button>
      </div>
    </div>
  );
}
