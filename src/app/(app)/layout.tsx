import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { AppShell } from "~/components/nav/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/sign-in");
  }

  return <AppShell user={session.user}>{children}</AppShell>;
}
