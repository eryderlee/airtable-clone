/**
 * Edge-safe Auth.js configuration.
 *
 * This file is intentionally lightweight — it contains ONLY the providers and pages
 * config. No database adapter, no DB imports. This allows the middleware (proxy.ts)
 * to import this safely in the Edge runtime without bundling Node.js-only modules.
 *
 * @see https://authjs.dev/guides/edge-compatibility
 */
import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/sign-in",
  },
} satisfies NextAuthConfig;
