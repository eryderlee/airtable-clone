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
    redirect("/");
  }

  const firstTable = tables[0];
  const views = await api.view.getByTableId({ tableId: firstTable?.id ?? "" });

  const firstView = views[0];
  redirect(`/base/${baseId}/${firstTable?.id}/view/${firstView?.id}`);
}
