/**
 * Edge-compatible Auth.js middleware proxy.
 *
 * Follows the Auth.js v5 two-file edge split pattern (CVE-2025-29927 defense).
 * This file imports ONLY auth.config.ts (no DB adapter, no Node.js-only modules),
 * making it safe to run in the Edge runtime.
 *
 * The full auth instance (with DrizzleAdapter) lives in src/server/auth.ts and
 * is used by server components, tRPC procedures, and API routes in Node.js runtime.
 *
 * CRITICAL: Every protectedProcedure independently verifies the session via auth()
 * — do NOT rely on this middleware having validated the session.
 *
 * @see https://authjs.dev/guides/edge-compatibility
 */
import NextAuth from "next-auth";
import { authConfig } from "~/server/auth.config";

export const { auth: middleware } = NextAuth(authConfig);
export default middleware;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
