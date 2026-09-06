"use client";
import { appFetch } from "@/lib/client-api";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, LoaderCircle } from "lucide-react";
import { taskSchema } from "@/lib/validation";
import { fromInputDate, toInputDate } from "@/lib/dates";
import type { Task } from "@/lib/types";
const formSchema = taskSchema
  .omit({ due_at: true, course_code: true })
  .extend({ due_local: z.string(), course_code: z.string().trim().max(30) });
type Values = z.infer<typeof formSchema>;
export function TaskForm({
  task,
  onClose,
  onSaved,
}: {
  task?: Task;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      due_local: toInputDate(task?.due_at || null),
      priority: task?.priority || "medium",
      category: task?.category || "",
      course_code: task?.course_code || "",
      status: task?.status || "pending",
    },
  });
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function save(values: Values) {
    setError("");
    try {
      const { due_local, ...rest } = values;
      const response = await appFetch(
        task ? "/api/tasks/" + task.id : "/api/tasks",
        {
          method: task ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...rest, due_at: fromInputDate(due_local) }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save task.");
    }
  }
  return (
    <dialog
      ref={dialog}
      className="task-dialog"
      onCancel={(e) => {
        if (isSubmitting) e.preventDefault();
        else onClose();
      }}
      aria-labelledby="task-dialog-title"
    >
      <form onSubmit={handleSubmit(save)}>
        <div className="dialog-heading">
          <span className="dialog-icon">
            <Plus size={22} />
          </span>
          <div>
            <h2 id="task-dialog-title">
              {task ? "Edit task" : "Make a little progress."}
            </h2>
            <p>
              {task
                ? "Update the details and keep moving."
                : "Capture what needs your attention."}
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            className="icon-button"
            onClick={onClose}
            aria-label="Close task form"
          >
            <X size={20} />
          </button>
        </div>
        <div className="dialog-body">
          <label>
            Task title <span className="required">*</span>
            <input
              autoFocus
              placeholder="e.g. Prepare CSE101 lecture slides"
              {...register("title")}
              aria-invalid={!!errors.title}
            />
            {errors.title && (
              <small className="error">{errors.title.message}</small>
            )}
          </label>
          <label>
            Description
            <textarea
              rows={3}
              placeholder="A few details to help future you…"
              {...register("description")}
            />
            {errors.description && (
              <small className="error">{errors.description.message}</small>
            )}
          </label>
          <div className="form-grid">
            <label>
              Due date & time
              <input type="datetime-local" {...register("due_local")} />
              <small>Asia/Dhaka · UTC+06:00</small>
            </label>
            <label>
              Priority
              <select aria-label="Priority" {...register("priority")}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label>
              Category
              <input
                aria-label="Category"
                list="categories"
                placeholder="e.g. Teaching"
                maxLength={60}
                {...register("category")}
              />
              <datalist id="categories">
                {[
                  "Teaching",
                  "Research",
                  "Grading",
                  "Administration",
                  "Advising",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </datalist>
            </label>
            <label>
              Course code
              <input
                placeholder="e.g. CSE101"
                maxLength={30}
                {...register("course_code")}
              />
            </label>
            <label>
              Status
              <select aria-label="Status" {...register("status")}>
                <option value="pending">Pending</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
        </div>
        <div className="dialog-footer">
          <button
            type="button"
            className="secondary"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Plus size={17} />
            )}{" "}
            {task ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
