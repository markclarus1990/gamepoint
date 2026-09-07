import { supabase } from "@/lib/supabase";
import { MAX_NBA_PLAYERS } from "@/lib/constants/nba";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit") as string) : MAX_NBA_PLAYERS;

    let registrations: any = null;
    try {
      const res = await supabase
        .from("tournament_registrations")
        .select("user_id, team, created_at")
        .eq("tournament_type", "nba")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (res.error) throw res.error;
      registrations = res.data as any;
    } catch {
      const res = await supabase.from("tournament_registrations").select("user_id, team, created_at").order("created_at", { ascending: true }).limit(limit);
      registrations = res.data as any;
    }

    const regArray = registrations || [];

    if (regArray.length === 0) {
      return Response.json({ players: [], count: 0, eastCount: 0, westCount: 0, tournamentStarted: false });
    }

    const userIds = regArray.map((r: any) => r.user_id);
    const { data: players } = await supabase.from("users").select("id, name, avatar_url, points").in("id", userIds);

    const playerMap = new Map((players || []).map((p: any) => [p.id, { ...p, registeredAt: null }]));

    const orderedPlayers = regArray.map((r: any, i: number) => ({
      ...(playerMap.get(r.user_id) || { id: r.user_id, name: "Unknown", avatar_url: null, points: 0 }),
      slotIndex: i + 1,
      team: r.team,
    }));

    // East = first 8 by registration order, West = next 8 (balanced)
    const eastCount = Math.min(8, Math.ceil(orderedPlayers.length / 2));
    const westCount = orderedPlayers.length - eastCount;

    const conferencePlayers = orderedPlayers.map((p: any, i: number) => {
      const conference = i < eastCount ? "East" : "West";
      return { ...p, conference, slotIndex: i + 1 };
    });

    return Response.json({
      players: conferencePlayers,
      count: orderedPlayers.length,
      eastCount,
      westCount,
      tournamentStarted: orderedPlayers.length === MAX_NBA_PLAYERS,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: string }).message) : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}


