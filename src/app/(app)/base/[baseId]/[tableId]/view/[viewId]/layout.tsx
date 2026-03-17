import { ViewsPanel } from "~/components/nav/ViewsPanel";

export default async function ViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  const { tableId, viewId } = await params;

  return (
    <div className="flex flex-1 overflow-hidden">
      <ViewsPanel tableId={tableId} activeViewId={viewId} />
      <main className="flex flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
