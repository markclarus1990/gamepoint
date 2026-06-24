import { LeaderboardService } from "@/lib/services/LeaderboardService";

const leaderboardService = new LeaderboardService();

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await leaderboardService.getTopPlayers();
  return Response.json(data);
}
