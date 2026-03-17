export default async function ViewPage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  const { tableId, viewId } = await params;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-lg font-medium text-gray-500">
        Grid will be rendered here in Phase 4
      </p>
      <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <p>
          <span className="font-medium">Table ID:</span> {tableId}
        </p>
        <p>
          <span className="font-medium">View ID:</span> {viewId}
        </p>
      </div>
    </div>
  );
}
