"use client";
import { Check, Clock3, Pencil, Trash2 } from "lucide-react";
import { displayDate } from "@/lib/dates";
import type { Task } from "@/lib/types";
export function TaskRow({
  task,
  onEdit,
  onToggle,
  onDelete,
  busy,
}: {
  task: Task;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const overdue =
    task.status !== "completed" &&
    !!task.due_at &&
    new Date(task.due_at) < new Date();
  return (
    <article
      className={
        "task-row " + (task.status === "completed" ? "is-completed" : "")
      }
    >
      <button
        className={
          "task-check " + (task.status === "completed" ? "checked" : "")
        }
        aria-label={
          (task.status === "completed" ? "Reopen " : "Complete ") + task.title
        }
        disabled={busy}
        onClick={onToggle}
      >
        {task.status === "completed" && <Check size={14} />}
      </button>
      <div className="task-copy">
        <button className="task-title" onClick={onEdit}>
          {task.title}
        </button>
        {task.description && (
          <p className="task-description">{task.description}</p>
        )}
        <div className="task-meta">
          {task.course_code && (
            <span className="course-tag">{task.course_code}</span>
          )}
          {task.category && <span>{task.category}</span>}
          <span className={overdue ? "overdue" : ""}>
            <Clock3 size={12} />
            {displayDate(task.due_at)}
            {overdue ? " · Overdue" : ""}
          </span>
        </div>
      </div>
      <div className="task-side">
        <span className={"priority " + task.priority}>
          <i />
          {task.priority}
        </span>
        <span className="status-label">{task.status.replace("_", " ")}</span>
      </div>
      <div className="row-actions">
        <button
          className="icon-button"
          onClick={onEdit}
          disabled={busy}
          aria-label={"Edit " + task.title}
        >
          <Pencil size={15} />
        </button>
        <button
          className="icon-button danger"
          onClick={onDelete}
          disabled={busy}
          aria-label={"Delete " + task.title}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}
