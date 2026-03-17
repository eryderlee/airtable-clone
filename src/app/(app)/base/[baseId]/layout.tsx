import { TableTabBar } from "~/components/nav/TableTabBar";

export default async function BaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <TableTabBar baseId={baseId} />
      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
