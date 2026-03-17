export default async function BaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string }>;
}) {
  // Await params per Next.js 15 requirement (params is a Promise in server components)
  await params;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex h-10 flex-shrink-0 items-center border-b border-gray-200 bg-white px-2">
        <span className="text-sm text-gray-400">Tables loading...</span>
      </header>
      <div className="flex flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
