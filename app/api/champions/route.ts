import { supabase } from "@/lib/supabase";
import { MANUAL_CHAMPIONS, NBA_SEASON_TITLE } from "@/lib/constants/champions";

export type HallOfFameEntry = {
  userId: string;
  name: string;
  avatar_url: string | null;
  titles: string[];
  team?: string | null;
};

export async function GET() {
  try {
    // NBA Season 1 champion — live from the completed Finals.
    let nba: { team: string; userId: string | null; userName: string | null } | null = null;
    try {
      const { data: fin } = await supabase
        .from("tournament_matches")
        .select("team1,team2,winner,winner_user_id,status")
        .eq("match_id", "nba-r4-final")
        .maybeSingle();
      const row = fin as {
        team1?: string | null;
        team2?: string | null;
        winner?: string | null;
        winner_user_id?: string | null;
        status?: string | null;
      } | null;
      if (row?.status === "completed" && row.winner) {
        let userName: string | null = null;
        if (row.winner_user_id) {
          const { data: u } = await supabase
            .from("users")
            .select("name")
            .eq("id", row.winner_user_id)
            .maybeSingle();
          userName = (u as { name?: string } | null)?.name ?? null;
        }
        nba = { team: row.winner, userId: row.winner_user_id ?? null, userName };
      }
    } catch {
      nba = null;
    }

    // Manual-title holders with fresh names/avatars.
    const ids = MANUAL_CHAMPIONS.map((c) => c.userId);
    let userMap = new Map<string, { name: string; avatar_url: string | null }>();
    try {
      if (ids.length > 0) {
        const { data: users } = await supabase.from("users").select("id,name,avatar_url").in("id", ids);
        userMap = new Map(
          ((users as { id: string; name: string; avatar_url: string | null }[]) || []).map((u) => [
            u.id,
            { name: u.name, avatar_url: u.avatar_url },
          ])
        );
      }
    } catch {}

    const hallOfFame: HallOfFameEntry[] = [];
    if (nba?.userId) {
      try {
        const { data: u } = await supabase
          .from("users")
          .select("id,name,avatar_url")
          .eq("id", nba.userId)
          .maybeSingle();
        const row = u as { id: string; name: string; avatar_url: string | null } | null;
        hallOfFame.push({
          userId: nba.userId,
          name: row?.name ?? nba.userName ?? "Champion",
          avatar_url: row?.avatar_url ?? null,
          titles: [NBA_SEASON_TITLE],
          team: nba.team,
        });
      } catch {
        hallOfFame.push({
          userId: nba.userId,
          name: nba.userName ?? "Champion",
          avatar_url: null,
          titles: [NBA_SEASON_TITLE],
          team: nba.team,
        });
      }
    }
    for (const c of MANUAL_CHAMPIONS) {
      const existing = hallOfFame.find((h) => h.userId === c.userId);
      if (existing) {
        if (!existing.titles.includes(c.title)) existing.titles.push(c.title);
        continue;
      }
      const u = userMap.get(c.userId);
      hallOfFame.push({
        userId: c.userId,
        name: u?.name ?? c.name,
        avatar_url: u?.avatar_url ?? null,
        titles: [c.title],
      });
    }

    return Response.json({ nba, hallOfFame });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
