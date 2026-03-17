import { redirect } from "next/navigation";

import { api } from "~/trpc/server";

export default async function TableIndexPage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string }>;
}) {
  const { baseId, tableId } = await params;

  const views = await api.view.getByTableId({ tableId });

  if (views.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <p className="text-sm text-gray-500">No views found</p>
      </div>
    );
  }

  redirect(`/base/${baseId}/${tableId}/view/${views[0]?.id}`);
}
