import { auth, signOut } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Airtable <span className="text-[hsl(280,100%,70%)]">Clone</span>
          </h1>
          {session?.user && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-xl text-white">
                Welcome,{" "}
                <span className="font-semibold">
                  {session.user.name ?? session.user.email}
                </span>
              </p>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/sign-in" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
          {!session?.user && (
            <p className="text-white/70">
              <a
                href="/sign-in"
                className="rounded-full bg-white/10 px-10 py-3 font-semibold transition hover:bg-white/20"
              >
                Sign in
              </a>
            </p>
          )}
        </div>
      </main>
    </HydrateClient>
  );
}
