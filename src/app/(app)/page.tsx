import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { api } from "~/trpc/server";

export default async function AppIndexPage() {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  const bases = await api.base.getAll();

  if (bases.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold text-gray-700">No bases yet</h1>
        <p className="text-sm text-gray-500">
          Create your first base to get started.
        </p>
      </div>
    );
  }

  const firstBase = bases[0];
  redirect(`/base/${firstBase?.id}`);
}
