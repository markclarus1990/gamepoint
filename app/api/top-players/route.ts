import { LeaderboardService } from "@/lib/services/LeaderboardService";

const leaderboardService = new LeaderboardService();

// Cache Top-5 for 10 minutes (shared across visitors via CDN).
// This is the biggest Supabase saver: previously every page view scanned
// the full sessions table; now it's 1 tiny 5-row aggregated query per 10 min.
export const revalidate = 600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = Number(searchParams.get("limit") ?? 5);
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 50) : 5;

  const data = await leaderboardService.getTopPlayers(limit);
  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
    },
  });
}
