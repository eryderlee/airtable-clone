import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import { GridView } from "~/components/grid/GridView";

export default async function ViewPage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  const { baseId, tableId, viewId } = await params;

  let views;
  try {
    views = await api.view.getByTableId({ tableId });
  } catch {
    redirect(`/base/${baseId}`);
  }

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
