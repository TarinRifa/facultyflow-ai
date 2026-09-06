import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import type { Filters } from "@/lib/validation";
import { bounds, dateBoundary } from "@/lib/dates";
import { ApiError, databaseError } from "@/lib/api";
export async function listTasks(
  client: SupabaseClient<Database>,
  userId: string,
  filters: Filters,
  now = new Date(),
) {
  const b = bounds(now);
  let query = client
    .from("tasks")
    .select("*", { count: "exact" })
    .eq("user_id", userId);
  if (filters.status === "active") query = query.neq("status", "completed");
  else if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.priority !== "all")
    query = query.eq("priority", filters.priority);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.course)
    query = query.eq("course_code", filters.course.toUpperCase());
  if (filters.q) {
    // Quotes protect PostgREST syntax; escape wildcard characters for literal search.
    const term = filters.q.replace(/[\\%_]/g, "\\$&").replace(/"/g, '\\"');
    query = query.or(
      'title.ilike."%' + term + '%",description.ilike."%' + term + '%"',
    );
  }
  if (filters.period === "overdue")
    query = query.neq("status", "completed").lt("due_at", b.now);
  if (filters.period === "today")
    query = query
      .neq("status", "completed")
      .gte("due_at", b.start)
      .lt("due_at", b.end);
  if (filters.period === "upcoming")
    query = query
      .neq("status", "completed")
      .gte("due_at", b.now)
      .lt("due_at", b.upcomingEnd);
  try {
    if (filters.from) query = query.gte("due_at", dateBoundary(filters.from));
    if (filters.to)
      query = query.lt("due_at", dateBoundary(filters.to, undefined, true));
  } catch {
    throw new ApiError(400, "Invalid calendar date.");
  }
  if (filters.sort === "priority")
    query = query
      .order("priority_rank", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false });
  else if (filters.sort === "updated")
    query = query.order("updated_at", { ascending: false });
  else
    query = query
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("priority_rank", { ascending: false });
  const { data, error, count } = await query
    .order("id")
    .range(
      (filters.page - 1) * filters.limit,
      filters.page * filters.limit - 1,
    );
  databaseError(error);
  return {
    tasks: data || [],
    total: count || 0,
    page: filters.page,
    limit: filters.limit,
  };
}
export async function dashboard(
  client: SupabaseClient<Database>,
  userId: string,
) {
  const b = bounds();
  const base = () =>
    client
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
  const results = await Promise.all([
    base().neq("status", "completed"),
    base().eq("status", "completed"),
    base()
      .neq("status", "completed")
      .gte("due_at", b.now)
      .lt("due_at", b.upcomingEnd),
    base().neq("status", "completed").lt("due_at", b.now),
    client
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .neq("status", "completed")
      .lt("due_at", b.upcomingEnd)
      .order("due_at", { ascending: true })
      .order("priority_rank", { ascending: false })
      .order("id")
      .limit(6),
  ]);
  results.forEach((r) => databaseError(r.error));
  return {
    pending: results[0].count || 0,
    completed: results[1].count || 0,
    upcoming: results[2].count || 0,
    overdue: results[3].count || 0,
    total: (results[0].count || 0) + (results[1].count || 0),
    urgent: results[4].data || [],
    now: b.now,
    timezone: "Asia/Dhaka",
  };
}
