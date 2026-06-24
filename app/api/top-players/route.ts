import { LeaderboardService } from "@/lib/services/LeaderboardService";

const leaderboardService = new LeaderboardService();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit");

  const data = await leaderboardService.getTopPlayers(limit ? Number(limit) : undefined);
  return Response.json(data);
}
