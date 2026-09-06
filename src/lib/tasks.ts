import "server-only";
import type { Filters } from "@/lib/validation";
import type { Task } from "@/lib/types";
import { bounds, dateBoundary } from "@/lib/dates";
import { ApiError, databaseError } from "@/lib/api";
import { db } from "@/lib/db";
type TaskRow = Omit<
  Task,
  "due_at" | "completed_at" | "created_at" | "updated_at"
> & {
  due_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};
function task(row: TaskRow): Task {
  return {
    ...row,
    due_at: row.due_at?.toISOString() || null,
    completed_at: row.completed_at?.toISOString() || null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}
export async function listTasks(
  userId: string,
  filters: Filters,
  now = new Date(),
) {
  const b = bounds(now),
    values: unknown[] = [userId],
    where = ["user_id=$1"];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    where.push(sql.replace("?", "$" + values.length));
  };
  if (filters.status === "active") where.push("status<>'completed'");
  else if (filters.status !== "all") add("status=?", filters.status);
  if (filters.priority !== "all") add("priority=?", filters.priority);
  if (filters.category) add("category=?", filters.category);
  if (filters.course) add("course_code=?", filters.course.toUpperCase());
  if (filters.q) {
    values.push("%" + filters.q.replace(/[\\%_]/g, "\\$&") + "%");
    where.push(
      `(title ilike $${values.length} escape '\\' or description ilike $${values.length} escape '\\')`,
    );
  }
  if (filters.period === "overdue") {
    where.push("status<>'completed'");
    add("due_at<?", b.now);
  }
  if (filters.period === "today") {
    where.push("status<>'completed'");
    add("due_at>=?", b.start);
    add("due_at<?", b.end);
  }
  if (filters.period === "upcoming") {
    where.push("status<>'completed'");
    add("due_at>=?", b.now);
    add("due_at<?", b.upcomingEnd);
  }
  try {
    if (filters.from) add("due_at>=?", dateBoundary(filters.from));
    if (filters.to) add("due_at<?", dateBoundary(filters.to, undefined, true));
  } catch {
    throw new ApiError(400, "Invalid calendar date.");
  }
  const order =
    filters.sort === "priority"
      ? "priority_rank desc,due_at asc nulls last,id"
      : filters.sort === "updated"
        ? "updated_at desc,id"
        : "due_at asc nulls last,priority_rank desc,id";
  values.push(filters.limit, (filters.page - 1) * filters.limit);
  try {
    const result = await db.query<TaskRow & { total_count: string }>(
      `select *,count(*) over() total_count from public.tasks where ${where.join(" and ")} order by ${order} limit $${values.length - 1} offset $${values.length}`,
      values,
    );
    return {
      tasks: result.rows.map(({ total_count: _count, ...row }) => {
        void _count;
        return task(row);
      }),
      total: Number(result.rows[0]?.total_count || 0),
      page: filters.page,
      limit: filters.limit,
    };
  } catch (error) {
    databaseError(error);
  }
}
export async function dashboard(userId: string) {
  const b = bounds();
  try {
    const [counts, urgent] = await Promise.all([
      db.query<{
        pending: string;
        completed: string;
        upcoming: string;
        overdue: string;
        total: string;
      }>(
        `select count(*) filter(where status<>'completed') pending,count(*) filter(where status='completed') completed,count(*) filter(where status<>'completed' and due_at>=$2 and due_at<$3) upcoming,count(*) filter(where status<>'completed' and due_at<$2) overdue,count(*) total from public.tasks where user_id=$1`,
        [userId, b.now, b.upcomingEnd],
      ),
      db.query<TaskRow>(
        "select * from public.tasks where user_id=$1 and status<>'completed' and due_at<$2 order by due_at asc,priority_rank desc,id limit 6",
        [userId, b.upcomingEnd],
      ),
    ]);
    const c = counts.rows[0];
    return {
      pending: Number(c.pending),
      completed: Number(c.completed),
      upcoming: Number(c.upcoming),
      overdue: Number(c.overdue),
      total: Number(c.total),
      urgent: urgent.rows.map(task),
      now: b.now,
      timezone: "Asia/Dhaka",
    };
  } catch (error) {
    databaseError(error);
  }
}
