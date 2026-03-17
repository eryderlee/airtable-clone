export default async function ViewPage({
  params,
}: {
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  const { tableId, viewId } = await params;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white p-8">
      <p className="text-sm font-medium text-gray-400">
        Grid will be rendered here in Phase 4
      </p>
      <div
        className="rounded border px-4 py-3 text-xs text-gray-500"
        style={{ backgroundColor: "#f9f8fc", borderColor: "#e2e0ea" }}
      >
        <p>
          <span className="font-medium text-gray-600">Table:</span> {tableId}
        </p>
        <p className="mt-0.5">
          <span className="font-medium text-gray-600">View:</span> {viewId}
        </p>
      </div>
    </div>
  );
}
