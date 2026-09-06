"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ListTodo,
  LoaderCircle,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Dashboard, Task } from "@/lib/types";
import { TaskForm } from "./task-form";
import { TaskRow } from "./task-row";
const defaults = {
  q: "",
  status: "all",
  priority: "all",
  category: "",
  course: "",
  period: "all",
  from: "",
  to: "",
  sort: "due",
  page: "1",
};
type FilterState = typeof defaults;
export function Workspace({ view }: { view: "dashboard" | "tasks" }) {
  const router = useRouter();
  const [filters, setFilters] = useState(defaults),
    [ready, setReady] = useState(false),
    [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<Dashboard | null>(null),
    [tasks, setTasks] = useState<Task[]>([]),
    [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState<string | null>(null);
  const [editor, setEditor] = useState<Task | "new" | null>(null),
    [deleting, setDeleting] = useState<Task | null>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const read = () => {
      const p = new URLSearchParams(window.location.search);
      setFilters(
        Object.fromEntries(
          Object.entries(defaults).map(([k, v]) => [k, p.get(k) || v]),
        ) as FilterState,
      );
      setReady(true);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  useEffect(() => {
    if (deleting) confirmation.current?.showModal();
  }, [deleting]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== defaults[key as keyof FilterState])
          params.set(key, value);
      });
      window.history.replaceState(
        null,
        "",
        window.location.pathname + (params.size ? "?" + params : ""),
      );
      try {
        const paths =
          view === "dashboard"
            ? ["/api/dashboard"]
            : ["/api/dashboard", "/api/tasks?" + params];
        const results = await Promise.all(
          paths.map(async (path) => {
            const response = await fetch(path, { signal: controller.signal });
            const result = await response.json();
            if (response.status === 401) {
              router.push("/login");
              router.refresh();
              throw new Error("Your session has expired.");
            }
            if (!response.ok) throw new Error(result.error);
            return result;
          }),
        );
        setData(results[0]);
        if (view === "tasks") {
          setTasks(results[1].tasks);
          setTotal(results[1].total);
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Unable to load tasks.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, ready, refresh, router, view]);
  const change = (key: keyof FilterState, value: string) =>
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? value : "1",
    }));
  const reload = () => setRefresh((v) => v + 1);
  async function mutate(task: Task, remove = false) {
    setBusy(task.id);
    setError("");
    try {
      const response = await fetch("/api/tasks/" + task.id, {
        method: remove ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        ...(remove
          ? {}
          : {
              body: JSON.stringify({
                status: task.status === "completed" ? "pending" : "completed",
              }),
            }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(
        remove
          ? "Task deleted."
          : task.status === "completed"
            ? "Task reopened."
            : "One more thing, done.",
      );
      setDeleting(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update task.");
    } finally {
      setBusy(null);
    }
  }
  const visible = view === "dashboard" ? data?.urgent || [] : tasks;
  const completion = data?.total
    ? Math.round((data.completed / data.total) * 100)
    : 0;
  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const cards = [
    {
      label: "Pending tasks",
      value: data?.pending,
      icon: ListTodo,
      tone: "purple",
      note: "A little progress, every day",
      href: "/tasks?status=active",
    },
    {
      label: "Completed",
      value: data?.completed,
      icon: CheckCheck,
      tone: "green",
      note: "Space for what comes next",
      href: "/tasks?status=completed",
    },
    {
      label: "Upcoming",
      value: data?.upcoming,
      icon: CalendarDays,
      tone: "blue",
      note: "Now through the next 7 days",
      href: "/tasks?period=upcoming",
    },
    {
      label: "Overdue",
      value: data?.overdue,
      icon: CircleAlert,
      tone: "orange",
      note: "Ready for a fresh look",
      href: "/tasks?period=overdue",
    },
  ];
  return (
    <main className="workspace-content">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {view === "dashboard"
              ? "YOUR DAY, A LITTLE CLEARER"
              : "A PLACE FOR EVERY PRIORITY"}
          </div>
          <h1>
            {view === "dashboard" ? "Room to focus" : "My tasks"}
            <span className="heading-dot">.</span>
          </h1>
          <p>
            {view === "dashboard"
              ? "A clear view of your work. A little more space to do it well."
              : "Teaching, research, and the details in between. All in one place."}
          </p>
        </div>
        <button className="primary" onClick={() => setEditor("new")}>
          <Plus size={18} />
          New task
        </button>
      </div>
      <div className="date-strip">
        <span>
          <CalendarDays size={15} />
          {today}
        </span>
        <span className="timezone">Asia/Dhaka · Your academic workspace</span>
      </div>
      <section className="stats-grid" aria-label="Task summary">
        {cards.map((card) => (
          <Link className="stat-card" href={card.href} key={card.label}>
            <div className="stat-top">
              <span>{card.label}</span>
              <span className={"stat-icon " + card.tone}>
                <card.icon size={18} />
              </span>
            </div>
            <strong>{data ? card.value : "—"}</strong>
            <small>{card.note}</small>
          </Link>
        ))}
      </section>
      {notice && (
        <div className="notice" role="status">
          <Check size={16} />
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <CircleAlert size={18} />
          <div>
            <strong>We could not load everything.</strong>
            <p>{error}</p>
          </div>
          <button className="secondary" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      <div className={view === "dashboard" ? "dashboard-columns" : ""}>
        <section className="panel task-panel">
          <div className="panel-heading">
            <div>
              <h2>
                {view === "dashboard" ? "On your horizon" : "Your task list"}
                {view === "tasks" && (
                  <span className="count-pill">{total}</span>
                )}
              </h2>
              <p>
                {view === "dashboard"
                  ? "Overdue first, then the days ahead."
                  : "Small steps. Meaningful progress."}
              </p>
            </div>
            {view === "dashboard" ? (
              <Link className="text-link" href="/tasks">
                View all tasks <ArrowRight size={15} />
              </Link>
            ) : (
              <button
                className="secondary"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
              >
                <SlidersHorizontal size={15} />
                Filters
              </button>
            )}
          </div>
          {view === "tasks" && (
            <>
              <div className="list-toolbar">
                <label className="search-input">
                  <Search size={17} />
                  <input
                    aria-label="Search tasks"
                    placeholder="Search tasks…"
                    value={filters.q}
                    onChange={(e) => change("q", e.target.value)}
                  />
                </label>
                <select
                  aria-label="Sort tasks"
                  className="sort-select"
                  value={filters.sort}
                  onChange={(e) => change("sort", e.target.value)}
                >
                  <option value="due">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="updated">Recently updated</option>
                </select>
              </div>
              <div className="task-tabs" aria-label="Task status filters">
                {[
                  ["all", "All tasks"],
                  ["active", "Pending"],
                  ["in_progress", "In progress"],
                  ["completed", "Completed"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filters.status === value}
                    className={filters.status === value ? "selected" : ""}
                    onClick={() => change("status", value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {expanded && (
                <div className="filters-grid">
                  <label>
                    Priority
                    <select
                      value={filters.priority}
                      onChange={(e) => change("priority", e.target.value)}
                    >
                      <option value="all">All priorities</option>
                      {["low", "medium", "high", "urgent"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Due window
                    <select
                      value={filters.period}
                      onChange={(e) => change("period", e.target.value)}
                    >
                      <option value="all">Any time</option>
                      <option value="today">Today</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </label>
                  <label>
                    Course
                    <input
                      value={filters.course}
                      placeholder="CSE101"
                      onChange={(e) => change("course", e.target.value)}
                    />
                  </label>
                  <label>
                    Category
                    <input
                      value={filters.category}
                      placeholder="Teaching"
                      onChange={(e) => change("category", e.target.value)}
                    />
                  </label>
                  <label>
                    From
                    <input
                      type="date"
                      value={filters.from}
                      onChange={(e) => change("from", e.target.value)}
                    />
                  </label>
                  <label>
                    Through
                    <input
                      type="date"
                      value={filters.to}
                      onChange={(e) => change("to", e.target.value)}
                    />
                  </label>
                  <button
                    className="text-link"
                    onClick={() => setFilters(defaults)}
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </>
          )}
          <div aria-busy={loading}>
            {loading ? (
              <div className="loading-state" role="status">
                <LoaderCircle className="spin" size={24} />
                <span>Bringing your workspace together…</span>
              </div>
            ) : error ? (
              <div className="empty-state">
                <CircleAlert size={28} />
                <h3>Your workspace is waiting.</h3>
                <p>Resolve the connection message above, then try again.</p>
              </div>
            ) : visible.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <CheckCheck size={30} />
                </span>
                <h3>
                  {view === "dashboard"
                    ? "A little breathing room."
                    : "Nothing here just yet."}
                </h3>
                <p>
                  {view === "dashboard"
                    ? "No deadlines on the horizon. Add your next task when ready."
                    : "Add a task or adjust your filters to find what you need."}
                </p>
                <button className="secondary" onClick={() => setEditor("new")}>
                  <Plus size={16} />
                  Add a task
                </button>
              </div>
            ) : (
              visible.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onEdit={() => setEditor(task)}
                  onToggle={() => mutate(task)}
                  onDelete={() => setDeleting(task)}
                  busy={busy === task.id}
                />
              ))
            )}
          </div>
          {view === "tasks" && total > 0 && (
            <div className="pagination">
              <span>
                {total} tasks · Page {filters.page} of{" "}
                {Math.max(1, Math.ceil(total / 12))}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={Number(filters.page) <= 1 || loading}
                  onClick={() =>
                    change("page", String(Number(filters.page) - 1))
                  }
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={Number(filters.page) * 12 >= total || loading}
                  onClick={() =>
                    change("page", String(Number(filters.page) + 1))
                  }
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </section>
        {view === "dashboard" && (
          <aside className="insights">
            <section className="panel progress-panel">
              <div className="eyebrow">THE BIG PICTURE</div>
              <h2>Every little win counts.</h2>
              <div
                className="progress-ring"
                style={
                  { "--progress": completion + "%" } as React.CSSProperties
                }
              >
                <div>
                  <strong>
                    {completion}
                    <span>%</span>
                  </strong>
                  <small>completed</small>
                </div>
              </div>
              <p>
                {data
                  ? data.completed + " of " + data.total + " tasks completed"
                  : "Your progress will appear here."}
              </p>
              <div className="progress-legend">
                <span>
                  <i />
                  Completed
                </span>
                <span>
                  <i />
                  Still in motion
                </span>
              </div>
            </section>
            <section className="focus-note">
              <span className="eyebrow">ONE THING AT A TIME</span>
              <h3>
                Great work starts
                <br />
                with a clear next step.
              </h3>
              <p>
                Pick one task that matters today.
                <br />
                Give it your full attention.
              </p>
              <Link href="/tasks?period=today">
                Find today&apos;s focus <ArrowRight size={16} />
              </Link>
            </section>
            <div className="timezone-note">
              <Clock3 size={14} />
              All deadlines shown in Asia/Dhaka.
            </div>
          </aside>
        )}
      </div>
      {editor && (
        <TaskForm
          key={editor === "new" ? "new" : editor.id}
          task={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setNotice(
              editor === "new"
                ? "Your next step is on the list."
                : "Task updated.",
            );
            reload();
          }}
        />
      )}
      {deleting && (
        <dialog
          className="confirm-dialog"
          ref={confirmation}
          aria-labelledby="delete-title"
          onCancel={(e) => {
            if (busy) e.preventDefault();
            else setDeleting(null);
          }}
        >
          <h2 id="delete-title">Delete this task?</h2>
          <p>{deleting.title} will be permanently removed.</p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="confirm-actions">
            <button
              className="secondary"
              disabled={!!busy}
              onClick={() => setDeleting(null)}
            >
              Keep task
            </button>
            <button
              className="delete-button"
              disabled={!!busy}
              onClick={() => mutate(deleting, true)}
            >
              {busy ? "Deleting…" : "Delete task"}
            </button>
          </div>
        </dialog>
      )}
    </main>
  );
}
