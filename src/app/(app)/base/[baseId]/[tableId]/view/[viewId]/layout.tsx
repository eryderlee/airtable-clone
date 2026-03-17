export default async function ViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  // Await params per Next.js 15 requirement (params is a Promise in server components)
  await params;

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-48 flex-shrink-0 flex-col border-r border-gray-200 bg-gray-50 p-2">
        <span className="text-sm text-gray-400">Views loading...</span>
      </aside>
      <main className="flex flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
