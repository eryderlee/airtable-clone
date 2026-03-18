import { api } from "~/trpc/server";
import { HomeContent } from "~/components/home/HomeContent";

export default async function AppHomePage() {
  const bases = (await api.base.getAll()) ?? [];
  return <HomeContent bases={bases} />;
}
