/**
 * Edge-compatible Auth.js middleware proxy.
 *
 * This file follows the Auth.js v5 two-file edge split pattern to avoid the
 * CVE-2025-29927 vulnerability. The proxy/middleware only checks the session
 * JWT (no DB adapter calls in edge runtime), while the full auth config in
 * src/server/auth/index.ts handles DB operations in Node.js runtime.
 *
 * @see https://authjs.dev/guides/edge-compatibility
 */
export { auth as middleware } from "~/server/auth";

export const config = {
  /**
   * Match all request paths except for the ones starting with:
   * - api (API routes)
   * - _next/static (static files)
   * - _next/image (image optimization files)
   * - favicon.ico (favicon file)
   */
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
