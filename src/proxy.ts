import { NextResponse, type NextRequest } from "next/server";
const COOKIE = "facultyflow_session";
export function proxy(request: NextRequest) {
  if (!request.cookies.has(COOKIE))
    return NextResponse.redirect(new URL("/login", request.url));
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/dashboard/:path*", "/tasks/:path*"] };
