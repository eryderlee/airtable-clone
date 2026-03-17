/**
 * Full Auth.js instance for Node.js runtime (non-edge).
 *
 * This file includes the DrizzleAdapter and JWT session strategy. It must NOT
 * be imported in Edge runtime code (middleware/proxy.ts) — use auth.config.ts instead.
 *
 * SECURITY NOTE: Every protectedProcedure calls auth() independently (CVE-2025-29927 defense).
 * Do NOT rely on proxy.ts having verified the session — always re-verify in server code.
 *
 * @see https://authjs.dev/guides/edge-compatibility
 */
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { type DefaultSession } from "next-auth";

import { db } from "~/server/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "~/server/db/schema";
import { authConfig } from "./auth.config";

/**
 * Module augmentation for `next-auth` types.
 * Allows us to add a user.id to the session object with full type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
  },
});
