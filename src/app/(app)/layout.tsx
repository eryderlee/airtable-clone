import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-gray-200 bg-white p-3">
        <p className="text-sm text-gray-400">Bases loading...</p>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
