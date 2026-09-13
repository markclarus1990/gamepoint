import { supabase } from "@/lib/supabase";
import { MAX_NBA_PLAYERS, EAST_SLOTS, WEST_SLOTS } from "@/lib/constants/nba";
import { buildConferencePlayers } from "@/lib/tournament/nba-helpers";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit") as string) : MAX_NBA_PLAYERS;

    let registrations: any = null;
    try {
      const res = await supabase
        .from("tournament_registrations")
        .select("user_id, team, created_at, conference, division")
        .eq("tournament_type", "nba")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (res.error) throw res.error;
      registrations = res.data as any;
    } catch {
      const res = await supabase.from("tournament_registrations").select("user_id, team, created_at, conference, division").order("created_at", { ascending: true }).limit(limit);
      registrations = res.data as any;
    }

    const regArray = (registrations as any[]) || [];

    if (regArray.length === 0) {
      return Response.json({ players: [], count: 0, eastCount: 0, westCount: 0, tournamentStarted: false });
    }

    const userIds = regArray.map((r: any) => r.user_id);
    const { data: players } = await supabase.from("users").select("id, name, avatar_url, points").in("id", userIds);

    const playerMap = new Map((players || []).map((p: any) => [p.id, { ...p, registeredAt: null }]));

    // Auto-populate to own conference by real team mapping (not registration order)
    const { conferencePlayers, eastCount, westCount } = buildConferencePlayers(regArray as any, playerMap as Map<string, unknown>);

    const tournamentStarted = regArray.length === MAX_NBA_PLAYERS && eastCount === EAST_SLOTS && westCount === WEST_SLOTS;

    return Response.json({
      players: conferencePlayers,
      count: regArray.length,
      eastCount,
      westCount,
      tournamentStarted,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: string }).message) : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}


