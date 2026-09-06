import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { serverClient } from "@/lib/supabase/server";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authenticated() {
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new ApiError(401, "Please sign in to continue.");
  return { client, user };
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ApiError(403, "This request is not allowed.");
}
export function databaseError(error: { code?: string } | null) {
  if (!error) return;
  if (["PGRST205", "42P01"].includes(error.code || ""))
    throw new ApiError(
      503,
      "Database setup is pending. Run the FacultyFlow migration in Supabase SQL Editor.",
    );
  throw new ApiError(
    500,
    "We could not save or load your tasks. Please try again.",
  );
}
export function respond(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function fail(error: unknown) {
  if (error instanceof ZodError)
    return respond(
      { error: error.issues[0]?.message || "Invalid input." },
      400,
    );
  if (error instanceof SyntaxError)
    return respond({ error: "Invalid request body." }, 400);
  if (error instanceof ApiError)
    return respond({ error: error.message }, error.status);
  return respond({ error: "Something went wrong. Please try again." }, 500);
}
export async function body(request: Request) {
  const text = await request.text();
  if (text.length > 12000) throw new ApiError(413, "Request is too large.");
  return JSON.parse(text);
}
