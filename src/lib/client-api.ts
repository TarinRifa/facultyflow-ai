"use client";
export type Toast = { id: string; message: string; kind: "success" | "error" };
export const toastEvent = "facultyflow:toast";
function notify(message: string, kind: Toast["kind"]) {
  window.dispatchEvent(
    new CustomEvent<Toast>(toastEvent, {
      detail: { id: crypto.randomUUID(), message, kind },
    }),
  );
}
// Shared request wrapper leaves response bodies available to the calling form.
export async function appFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(
    input instanceof Request ? input.url : String(input),
    window.location.origin,
  );
  const method = (
    init?.method || (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  const mutation =
    url.origin === window.location.origin &&
    url.pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    !url.pathname.startsWith("/api/auth") &&
    url.pathname !== "/api/chat" &&
    url.pathname !== "/api/chat/select-task";
  try {
    const response = await fetch(input, init);
    if (mutation) {
      const data = await response
        .clone()
        .json()
        .catch(() => ({}));
      if (!response.ok)
        notify(
          data.error || "The change could not be saved. Please retry.",
          "error",
        );
      else {
        const path = url.pathname;
        const name = path.startsWith("/api/tasks")
          ? "Task"
          : path.includes("/admin/users")
            ? "User"
            : path.includes("/admin/settings")
              ? "Academic settings"
              : path.includes("/courses")
                ? "Course"
                : path.includes("/syllabus")
                  ? "Syllabus"
                  : path.includes("/routines")
                    ? "Class routine"
                    : path.includes("/notifications")
                      ? "Notifications"
                      : path.includes("/roadmap")
                        ? "Roadmap"
                        : path.includes("/questions") ||
                            url.searchParams.get("type") === "questions"
                          ? "Questions"
                          : path.includes("/plans")
                            ? "Assessment plan"
                            : path.includes("/assessments") ||
                                path.includes("/editor")
                              ? "Assessment"
                              : path.includes("/assignments")
                                ? "Assignment analysis"
                                : path.includes("/previous-papers")
                                  ? "Question paper"
                                  : "Changes";
        notify(
          path === "/api/chat/actions"
            ? data.message || "Action completed."
            : name +
                (method === "DELETE"
                  ? " deleted."
                  : method === "PATCH" || method === "PUT"
                    ? " updated."
                    : " saved."),
          "success",
        );
        window.dispatchEvent(
          new CustomEvent("facultyflow:changed", { detail: { path } }),
        );
      }
    }
    return response;
  } catch (error) {
    if (mutation && !(error instanceof Error && error.name === "AbortError"))
      notify("Connection failed. Check your connection and retry.", "error");
    throw error;
  }
}
