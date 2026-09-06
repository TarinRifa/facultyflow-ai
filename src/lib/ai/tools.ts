import "server-only";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { db } from "../db";
import { bounds, dateBoundary, TIMEZONE } from "../dates";
import {
  toolSchemas,
  searchSchema,
  summarySchema,
  recommendationSchema,
  type TaskReference,
} from "./schema";
import {
  actionToolSchemas,
  proposeAssistantAction,
  type AssistantAction,
} from "./actions";

export type ToolResult = {
  data: Record<string, unknown>;
  tasks: TaskReference[];
  actions?: AssistantAction[];
};
const fields =
  "id,title,left(description,1000) description,due_at,priority,status,category,course_code";
export async function executeTool(
  userId: string,
  name: string,
  args: unknown,
  now = new Date(),
): Promise<ToolResult> {
  if (!Object.hasOwn(toolSchemas, name)) throw new Error("Unknown tool");
  if (Object.hasOwn(actionToolSchemas, name)) {
    const action = await proposeAssistantAction(
      userId,
      name as keyof typeof actionToolSchemas,
      args,
    );
    return {
      data: {
        proposal: action,
        requires_user_approval: true,
        instruction: action.selection_required
          ? "Tell the user to choose a task from the current-task picker, then confirm. No task has been deleted."
          : "Tell the user to review the proposal card and choose Approve or Cancel. Do not claim it already happened.",
      },
      tasks: [],
      actions: [action],
    };
  }
  const readToolSchemas = {
    search_tasks: searchSchema,
    get_task_summary: summarySchema,
    get_priority_recommendations: recommendationSchema,
  };
  const parsed =
    readToolSchemas[name as keyof typeof readToolSchemas].parse(args);
  const values: unknown[] = [userId];
  const where = ["user_id=$1"];
  const param = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  if (parsed.category) where.push(`category=${param(parsed.category)}`);
  if (parsed.course)
    where.push(`course_code=${param(parsed.course.toUpperCase())}`);
  if (parsed.course_prefix)
    where.push(
      `starts_with(course_code,${param(parsed.course_prefix.toUpperCase())})`,
    );
  if ("from" in parsed && parsed.from)
    where.push(`due_at>=${param(dateBoundary(parsed.from))}`);
  if ("to" in parsed && parsed.to)
    where.push(`due_at<${param(dateBoundary(parsed.to, TIMEZONE, true))}`);
  const b = bounds(now);
  const query = async <T extends Record<string, unknown>>(text: string) => {
    const config = { text, values, query_timeout: 8000 };
    return (await db.query<T>(config)).rows;
  };
  if (name === "get_task_summary") {
    const instant = param(b.now),
      end = param(b.upcomingEnd);
    const rows = await query<{
      status: string;
      priority: string;
      category: string;
      course_code: string;
      count: number;
      overdue: number;
      upcoming: number;
    }>(
      `select status,priority,category,course_code,count(*)::int count,count(*) filter(where status<>'completed' and due_at<${instant})::int overdue,count(*) filter(where status<>'completed' and due_at>=${instant} and due_at<${end})::int upcoming from public.tasks where ${where.join(" and ")} group by status,priority,category,course_code`,
    );
    const summary = {
      total: 0,
      pending: 0,
      completed: 0,
      overdue: 0,
      upcoming: 0,
      by_status: {} as Record<string, number>,
      by_priority: {} as Record<string, number>,
      by_category: {} as Record<string, number>,
      by_course: {} as Record<string, number>,
    };
    for (const row of rows) {
      summary.total += row.count;
      summary[row.status === "completed" ? "completed" : "pending"] +=
        row.count;
      summary.overdue += row.overdue;
      summary.upcoming += row.upcoming;
      for (const [bucket, key] of [
        [summary.by_status, row.status],
        [summary.by_priority, row.priority],
        [summary.by_category, row.category || "Uncategorized"],
        [summary.by_course, row.course_code || "No course"],
      ] as const) {
        Object.defineProperty(bucket, key, {
          value: (Object.hasOwn(bucket, key) ? bucket[key] : 0) + row.count,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }
    // Bound high-cardinality labels without changing exact totals.
    const trim = (groups: Record<string, number>) =>
      Object.fromEntries(
        Object.entries(groups)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50),
      );
    return {
      data: {
        ...summary,
        by_category: trim(summary.by_category),
        by_course: trim(summary.by_course),
        group_limit: 50,
        now: b.now,
        timezone: TIMEZONE,
      },
      tasks: [],
    };
  }
  let order: string,
    limit: number,
    extra = "";
  if (name === "get_priority_recommendations") {
    const input = toolSchemas.get_priority_recommendations.parse(args);
    const target = input.target_date
      ? new Date(dateBoundary(input.target_date))
      : now;
    const day = bounds(target);
    const cutoff = dateBoundary(
      format(addDays(toZonedTime(target, TIMEZONE), 4), "yyyy-MM-dd"),
    );
    const instant = param(target.toISOString()),
      start = param(day.start),
      end = param(day.end),
      soon = param(cutoff);
    extra = `,(case when due_at<${instant} then 100 when due_at>=${start} and due_at<${end} then 60 when due_at>=${end} and due_at<${soon} then 35 else 0 end + case priority when 'urgent' then 40 when 'high' then 25 when 'medium' then 10 else 0 end + case when status='in_progress' then 5 else 0 end) score`;
    where.push("status<>'completed'");
    order = "score desc,due_at asc nulls last,created_at asc,id";
    limit = input.limit;
  } else {
    const input = toolSchemas.search_tasks.parse(args);
    if (input.q)
      where.push(
        `(title ilike ${param("%" + input.q.replace(/[\\%_]/g, "\\$&") + "%")} or description ilike $${values.length})`,
      );
    if (input.statuses)
      where.push(`status=any(${param(input.statuses)}::text[])`);
    if (input.priorities)
      where.push(`priority=any(${param(input.priorities)}::text[])`);
    if (input.period !== "all") where.push("status<>'completed'");
    if (input.period === "overdue") where.push(`due_at<${param(b.now)}`);
    if (input.period === "today")
      where.push(`due_at>=${param(b.start)} and due_at<${param(b.end)}`);
    if (input.period === "upcoming")
      where.push(`due_at>=${param(b.now)} and due_at<${param(b.upcomingEnd)}`);
    order =
      input.sort === "priority"
        ? "priority_rank desc,due_at asc nulls last,id"
        : input.sort === "updated"
          ? "updated_at desc,id"
          : "due_at asc nulls last,priority_rank desc,id";
    limit = input.limit;
  }
  const limitParam = param(limit);
  const rows = await query<
    Record<string, unknown> & TaskReference & { total_count: number }
  >(
    `select ${fields},count(*) over()::int total_count${extra} from public.tasks where ${where.join(" and ")} order by ${order} limit ${limitParam}`,
  );
  const tasks = rows.map(({ id, title, due_at, priority, status }) => ({
    id,
    title,
    due_at: due_at ? new Date(due_at).toISOString() : null,
    priority,
    status,
  }));
  return {
    data: {
      tasks: rows,
      total: rows[0]?.total_count || 0,
      returned: rows.length,
      now: b.now,
      timezone: TIMEZONE,
      ...(name === "get_priority_recommendations"
        ? {
            basis:
              "Overdue +100; otherwise due today +60 or next three calendar days +35. Urgent +40, high +25, medium +10, low +0; in progress +5. Ties: earliest deadline, oldest creation, id. Declared urgency, not objective importance.",
          }
        : {}),
    },
    tasks,
  };
}
