import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { AppSidebar } from "~/components/nav/AppSidebar";

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
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
