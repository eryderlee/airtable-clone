import { api } from "~/trpc/server";
import { GridView } from "~/components/grid/GridView";

export default async function ViewPage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  const { tableId, viewId } = await params;

  const views = await api.view.getByTableId({ tableId });
  const activeView = views.find((v) => v.id === viewId);

  return (
    <GridView
      key={viewId}
      tableId={tableId}
      viewId={viewId}
      initialConfig={activeView?.config}
    />
  );
}
