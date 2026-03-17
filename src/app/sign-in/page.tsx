import { signIn } from "~/server/auth";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container flex flex-col items-center justify-center gap-8 px-4 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Airtable <span className="text-[hsl(280,100%,70%)]">Clone</span>
        </h1>
        <p className="text-lg text-white/70">Sign in to manage your bases</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="rounded-full bg-white px-10 py-3 font-semibold text-[#2e026d] transition hover:bg-white/90"
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  );
}
