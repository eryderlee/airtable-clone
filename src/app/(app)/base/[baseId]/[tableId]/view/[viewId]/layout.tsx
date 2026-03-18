export default async function ViewLayout({
  children,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string; tableId: string; viewId: string }>;
}) {
  return <>{children}</>;
}
