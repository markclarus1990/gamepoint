import { supabase } from "@/lib/supabase";
import { MAX_NBA_PLAYERS } from "@/lib/constants/nba";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const playerCount = parseInt(searchParams.get("count") || String(MAX_NBA_PLAYERS));

    // Prefer nba filtered count
    let registrations: any = null;
    try {
      const res = await supabase
        .from("tournament_registrations")
        .select("user_id, team, created_at")
        .eq("tournament_type", "nba")
        .order("created_at", { ascending: true })
        .limit(playerCount);
      if (res.error) throw res.error;
      registrations = res.data as any;
    } catch {
      const res = await supabase.from("tournament_registrations").select("user_id, team, created_at").order("created_at", { ascending: true }).limit(playerCount);
      registrations = res.data as any;
    }

    const regArray = registrations || [];

    if (regArray.length < playerCount) {
      return Response.json({
        error: `Need ${playerCount} players, got ${regArray.length} — first come gets fav team, 1 player = 1 team`,
        bracket: null,
        count: regArray.length,
        tournamentStarted: false,
      });
    }

    // Split into East (8) and West (8) based on registration order (seeds 1-8 each)
    const eastPlayers = regArray.slice(0, 8).map((r: any, i: number) => ({
      id: r.user_id,
      team: r.team as string,
      seed: i + 1,
      conference: "East" as const,
    }));

    const westPlayers = regArray.slice(8, 16).map((r: any, i: number) => ({
      id: r.user_id,
      team: r.team as string,
      seed: i + 1,
      conference: "West" as const,
    }));

    // Correct First Round: 1v8, 4v5, 3v6, 2v7
    const firstRoundEast = [
      { seed: 1, opponentSeed: 8, team1: eastPlayers[0].team, team2: eastPlayers[7].team, round: "First Round", matchId: "nba-r1-east-1v8" },
      { seed: 4, opponentSeed: 5, team1: eastPlayers[3].team, team2: eastPlayers[4].team, round: "First Round", matchId: "nba-r1-east-4v5" },
      { seed: 3, opponentSeed: 6, team1: eastPlayers[2].team, team2: eastPlayers[5].team, round: "First Round", matchId: "nba-r1-east-3v6" },
      { seed: 2, opponentSeed: 7, team1: eastPlayers[1].team, team2: eastPlayers[6].team, round: "First Round", matchId: "nba-r1-east-2v7" },
    ];

    const firstRoundWest = [
      { seed: 1, opponentSeed: 8, team1: westPlayers[0].team, team2: westPlayers[7].team, round: "First Round", matchId: "nba-r1-west-1v8" },
      { seed: 4, opponentSeed: 5, team1: westPlayers[3].team, team2: westPlayers[4].team, round: "First Round", matchId: "nba-r1-west-4v5" },
      { seed: 3, opponentSeed: 6, team1: westPlayers[2].team, team2: westPlayers[5].team, round: "First Round", matchId: "nba-r1-west-3v6" },
      { seed: 2, opponentSeed: 7, team1: westPlayers[1].team, team2: westPlayers[6].team, round: "First Round", matchId: "nba-r1-west-2v7" },
    ];

    const bracket = {
      east: {
        name: "East Conference",
        players: eastPlayers,
        firstRoundMatchups: firstRoundEast,
        conferenceFinals: null,
        champion: null,
      },
      west: {
        name: "West Conference",
        players: westPlayers,
        firstRoundMatchups: firstRoundWest,
        conferenceFinals: null,
        champion: null,
      },
      finals: {
        eastWinner: null,
        westWinner: null,
        champion: null,
      },
    };

    // Also return persisted matches if tournament auto-started (First Round generated on 16th registration)
    let matches: unknown[] = [];
    try {
      const res = await supabase.from("tournament_matches").select("*").eq("tournament_type", "nba").order("created_at", { ascending: true });
      matches = res.data || [];
    } catch {
      matches = [];
    }

    return Response.json({ bracket, matches, tournamentStarted: true, count: regArray.length });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: string }).message) : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}


