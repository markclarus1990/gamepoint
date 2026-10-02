import { LeaderboardService } from "@/lib/services/LeaderboardService";

const leaderboardService = new LeaderboardService();

// Live lookup — only called when a player explicitly searches, so no cache.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") ?? "").trim();

  if (!name || name.length < 2) {
    return Response.json({ error: "Enter at least 2 characters to search." }, { status: 400 });
  }

  const result = await leaderboardService.getPlayerRank(name);

  if (!result) {
    return Response.json({ error: "Player not found." }, { status: 404 });
  }

  return Response.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
