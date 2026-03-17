import { redirect } from "next/navigation";

import { api } from "~/trpc/server";

export default async function BaseIndexPage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;

  const tables = await api.table.getByBaseId({ baseId });

  if (tables.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <h1 className="text-2xl font-semibold text-gray-700">No tables yet</h1>
        <p className="text-sm text-gray-500">
          Create your first table to get started.
        </p>
      </div>
    );
  }

  const firstTable = tables[0];
  const views = await api.view.getByTableId({ tableId: firstTable?.id ?? "" });

  const firstView = views[0];
  redirect(`/base/${baseId}/${firstTable?.id}/view/${firstView?.id}`);
}
