import { auth } from "~/server/auth";
import { api } from "~/trpc/server";
import { BaseTopBar } from "~/components/nav/BaseTopBar";
import { BaseSidebar } from "~/components/nav/BaseSidebar";
import { TableTabBar } from "~/components/nav/TableTabBar";
import { BaseToucher } from "~/components/nav/BaseToucher";
import { BaseColorProvider } from "~/components/nav/BaseColorContext";

export default async function BaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;
  const session = await auth();

  let initialColor: string | null = null;
  let initialName: string | null = null;
  try {
    const base = await api.base.getById({ id: baseId });
    initialColor = base.color ?? null;
    initialName = base.name ?? null;
  } catch {
    // not found or auth error — components will handle gracefully
  }

  return (
    <BaseColorProvider initialColor={initialColor}>
      <div className="flex h-full w-full overflow-hidden">
        {/* Narrow dark left sidebar */}
        <BaseSidebar user={session?.user} />

        {/* Main content column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <BaseToucher baseId={baseId} />
          <BaseTopBar baseId={baseId} user={session?.user} initialColor={initialColor} initialName={initialName} />
          <TableTabBar baseId={baseId} initialColor={initialColor} initialName={initialName} />
          <div className="flex flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </BaseColorProvider>
  );
}
