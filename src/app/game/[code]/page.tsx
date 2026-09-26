import { PlayerGame } from "@/components/PlayerGame";

export default async function GamePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayerGame code={code.toUpperCase()} />;
}
