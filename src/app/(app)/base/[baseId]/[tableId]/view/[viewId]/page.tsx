import { GridView } from "~/components/grid/GridView";

export default async function ViewPage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  const { tableId, viewId } = await params;
  return <GridView tableId={tableId} viewId={viewId} />;
}
