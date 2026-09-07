import { supabase } from "@/lib/supabase";
import { NBA_TEAMS, TEAM_CONFERENCES, MAX_NBA_PLAYERS } from "@/lib/constants/nba";

async function generateFirstRoundIfNeeded() {
  // Check if we have 16 nba registrations and no matches yet -> auto-generate First Round
  try {
    const { data: regs } = await supabase
      .from("tournament_registrations")
      .select("user_id, team, created_at")
      .eq("tournament_type", "nba")
      .order("created_at", { ascending: true });

    const regArray = regs || [];
    if (regArray.length !== MAX_NBA_PLAYERS) return;

    const { data: existingMatches } = await supabase
      .from("tournament_matches")
      .select("match_id")
      .eq("tournament_type", "nba")
      .eq("round", "First Round");

    if (existingMatches && existingMatches.length > 0) return;

    const eastPlayers = regArray.slice(0, 8).map((r: any, i: number) => ({
      id: r.user_id,
      team: r.team as string,
      seed: i + 1,
    }));
    const westPlayers = regArray.slice(8, 16).map((r: any, i: number) => ({
      id: r.user_id,
      team: r.team as string,
      seed: i + 1,
    }));

    const matchDefs = [
      // East 1v8, 4v5, 3v6, 2v7
      { conference: "East" as const, a: eastPlayers[0], b: eastPlayers[7], seed1: 1, seed2: 8, id: "nba-r1-east-1v8" },
      { conference: "East" as const, a: eastPlayers[3], b: eastPlayers[4], seed1: 4, seed2: 5, id: "nba-r1-east-4v5" },
      { conference: "East" as const, a: eastPlayers[2], b: eastPlayers[5], seed1: 3, seed2: 6, id: "nba-r1-east-3v6" },
      { conference: "East" as const, a: eastPlayers[1], b: eastPlayers[6], seed1: 2, seed2: 7, id: "nba-r1-east-2v7" },
      // West same
      { conference: "West" as const, a: westPlayers[0], b: westPlayers[7], seed1: 1, seed2: 8, id: "nba-r1-west-1v8" },
      { conference: "West" as const, a: westPlayers[3], b: westPlayers[4], seed1: 4, seed2: 5, id: "nba-r1-west-4v5" },
      { conference: "West" as const, a: westPlayers[2], b: westPlayers[5], seed1: 3, seed2: 6, id: "nba-r1-west-3v6" },
      { conference: "West" as const, a: westPlayers[1], b: westPlayers[6], seed1: 2, seed2: 7, id: "nba-r1-west-2v7" },
    ];

    const rows = matchDefs.map((m: any) => ({
      match_id: m.id,
      tournament_type: "nba",
      round: "First Round",
      conference: m.conference,
      seed1: m.seed1,
      seed2: m.seed2,
      team1: m.a.team,
      team2: m.b.team,
      team1_user_id: m.a.id,
      team2_user_id: m.b.id,
      status: "scheduled",
    }));

    await supabase.from("tournament_matches").upsert(rows, { onConflict: "match_id" });
  } catch {
    // silent — table may not exist yet before migration
  }
}

export async function POST(req: Request) {
  try {
    const { user_id, team, tournament_type: explicitType } = await req.json();
    if (!user_id) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    // Tekken fallback: if no team provided, treat as tekken (8 slots, no team lock)
    // Keeps /tekken page working while NBA requires team
    const isTekken = (!team && explicitType === "tekken") || (!team && !explicitType);
    const isNba = Boolean(team) || explicitType === "nba";
    if (isTekken && !isNba) {
      // Tekken legacy flow — 8 max, no team
      let tekkenCount: number | null = null;
      try {
        const res = await supabase.from("tournament_registrations").select("*", { count: "exact", head: true }).eq("tournament_type", "tekken");
        tekkenCount = res.count;
      } catch {
        const res = await supabase.from("tournament_registrations").select("*", { count: "exact", head: true });
        tekkenCount = res.count;
      }
      if (tekkenCount != null && tekkenCount >= 8) return Response.json({ error: "Tekken tournament is full (8 players max)" }, { status: 400 });
      try {
        const { data: existing } = await supabase.from("tournament_registrations").select("id").eq("tournament_type", "tekken").eq("user_id", user_id).maybeSingle();
        if (existing) return Response.json({ error: "Already registered for Tekken" }, { status: 400 });
      } catch {
        const { data: existing } = await supabase.from("tournament_registrations").select("id").eq("user_id", user_id).maybeSingle();
        if (existing) return Response.json({ error: "Already registered" }, { status: 400 });
      }
      const payload: Record<string, unknown> = { user_id, tournament_type: "tekken" };
      if (team) payload.team = team;
      const { error } = await supabase.from("tournament_registrations").insert(payload);
      if (error) {
        if (error.message.includes("tournament_type")) {
          const fb = await supabase.from("tournament_registrations").insert({ user_id });
          if (fb.error) return Response.json({ error: fb.error.message }, { status: 500 });
        } else return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ success: true });
    }

    if (team && !NBA_TEAMS.includes(team as never)) {
      return Response.json({ error: "Invalid team name" }, { status: 400 });
    }
    if (!team) {
      return Response.json({ error: "team is required (1 player = 1 team) — first come gets fav team" }, { status: 400 });
    }

    // count nba only — fallback if column missing (pre-migration)
    let count: number | null = null;
    try {
      const res = await supabase
        .from("tournament_registrations")
        .select("*", { count: "exact", head: true })
        .eq("tournament_type", "nba");
      count = res.count;
    } catch {
      const res = await supabase.from("tournament_registrations").select("*", { count: "exact", head: true });
      count = res.count;
    }

    if (count != null && count >= MAX_NBA_PLAYERS) {
      return Response.json({ error: "Tournament is full (16 players max). First-come team lock." }, { status: 400 });
    }

    // Check team already taken (nba scope)
    try {
      const { data: takenTeam } = await supabase
        .from("tournament_registrations")
        .select("team")
        .eq("tournament_type", "nba")
        .eq("team", team)
        .maybeSingle();
      if (takenTeam) {
        return Response.json({ error: "Team already selected — first come gets fav team" }, { status: 400 });
      }
    } catch {
      const { data: takenTeam } = await supabase.from("tournament_registrations").select("team").eq("team", team).maybeSingle();
      if (takenTeam) return Response.json({ error: "Team already selected" }, { status: 400 });
    }

    try {
      const { data: existing } = await supabase
        .from("tournament_registrations")
        .select("id")
        .eq("tournament_type", "nba")
        .eq("user_id", user_id)
        .maybeSingle();
      if (existing) {
        return Response.json({ error: "Already registered (1 player = 1 team)" }, { status: 400 });
      }
    } catch {
      const { data: existing } = await supabase.from("tournament_registrations").select("id").eq("user_id", user_id).maybeSingle();
      if (existing) return Response.json({ error: "Already registered" }, { status: 400 });
    }

    // Also guard: if tournament already started (matches exist), block new registrations anyway (full check already)
    // Insert with conference/division for badge
    const teamInfo = TEAM_CONFERENCES[team];
    const payload: Record<string, unknown> = { user_id, team, tournament_type: "nba" };
    if (teamInfo) {
      payload.conference = teamInfo.conference;
      payload.division = teamInfo.division;
    }

    const { error } = await supabase.from("tournament_registrations").insert(payload);

    if (error) {
      // handle missing column before migration
      if (error.message.includes("tournament_type") || error.message.includes("conference")) {
        const fallback = await supabase.from("tournament_registrations").insert({ user_id, team });
        if (fallback.error) return Response.json({ error: fallback.error.message }, { status: 500 });
      } else {
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    // Auto-start tournament if now complete (16 teams) -> generate First Round matches
    await generateFirstRoundIfNeeded();

    // Return updated count for UI to switch to bracket view
    let newCount = count != null ? count + 1 : null;
    try {
      const res2 = await supabase.from("tournament_registrations").select("*", { count: "exact", head: true }).eq("tournament_type", "nba");
      newCount = res2.count;
    } catch {}

    const tournamentStarted = newCount === MAX_NBA_PLAYERS;

    return Response.json({ success: true, team, count: newCount, tournamentStarted });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: string }).message) : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "players";

    if (action === "players") {
      let registrations: any = null;
      try {
        const res = await supabase
          .from("tournament_registrations")
          .select("user_id, team, created_at")
          .eq("tournament_type", "nba")
          .order("created_at", { ascending: true });
        registrations = res.data as any;
        if (res.error) throw res.error;
      } catch {
        const res = await supabase.from("tournament_registrations").select("user_id, team, created_at").order("created_at", { ascending: true });
        registrations = res.data as any;
      }

      const regArray = registrations || [];
      if (regArray.length === 0) {
        return Response.json({ players: [], conference: "none", count: 0, eastCount: 0, westCount: 0, tournamentStarted: false });
      }

      const userIds = regArray.map((r: any) => r.user_id);
      const { data: players } = await supabase.from("users").select("id, name, avatar_url, points").in("id", userIds);
      const playerMap = new Map((players || []).map((p: any) => [p.id, { ...p, registeredAt: null }]));

      const orderedPlayers = regArray.map((r: any, i: number) => ({
        ...(playerMap.get(r.user_id) || { id: r.user_id, name: "Unknown" }),
        slotIndex: i + 1,
        team: r.team,
      }));

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
    }

    if (action === "bracket") {
      let registrations: any = null;
      try {
        const res = await supabase
          .from("tournament_registrations")
          .select("user_id, team, created_at")
          .eq("tournament_type", "nba")
          .order("created_at", { ascending: true });
        registrations = res.data as any;
        if (res.error) throw res.error;
      } catch {
        const res = await supabase.from("tournament_registrations").select("user_id, team, created_at").order("created_at", { ascending: true });
        registrations = res.data as any;
      }

      const regArray = registrations || [];

      if (regArray.length < MAX_NBA_PLAYERS) {
        return Response.json({
          error: `Need 16 players for full bracket, got ${regArray.length}`,
          bracket: null,
          count: regArray.length,
          tournamentStarted: false,
        });
      }

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

      const bracket = {
        east: {
          name: "East Conference",
          players: eastPlayers,
          firstRoundMatchups: [
            { seed1: 1, seed8: 8, team1: eastPlayers[0].team, team2: eastPlayers[7].team, matchId: "nba-r1-east-1v8" },
            { seed1: 4, seed2: 5, team1: eastPlayers[3].team, team2: eastPlayers[4].team, matchId: "nba-r1-east-4v5" },
            { seed1: 3, seed2: 6, team1: eastPlayers[2].team, team2: eastPlayers[5].team, matchId: "nba-r1-east-3v6" },
            { seed1: 2, seed2: 7, team1: eastPlayers[1].team, team2: eastPlayers[6].team, matchId: "nba-r1-east-2v7" },
          ],
        },
        west: {
          name: "West Conference",
          players: westPlayers,
          firstRoundMatchups: [
            { seed1: 1, seed2: 8, team1: westPlayers[0].team, team2: westPlayers[7].team, matchId: "nba-r1-west-1v8" },
            { seed1: 4, seed2: 5, team1: westPlayers[3].team, team2: westPlayers[4].team, matchId: "nba-r1-west-4v5" },
            { seed1: 3, seed2: 6, team1: westPlayers[2].team, team2: westPlayers[5].team, matchId: "nba-r1-west-3v6" },
            { seed1: 2, seed2: 7, team1: westPlayers[1].team, team2: westPlayers[6].team, matchId: "nba-r1-west-2v7" },
          ],
        },
        finals: {
          eastWinner: null,
          westWinner: null,
          champion: null,
        },
      };

      // Ensure matches persisted (idempotent)
      await generateFirstRoundIfNeeded();

      return Response.json({ bracket, tournamentStarted: true });
    }

    return Response.json({ players: [], conference: "none" });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: string }).message) : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { user_id, tournament_type: explicitType } = body;
    if (!user_id) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    // Tekken unregister path (no bracket lock)
    if (explicitType === "tekken") {
      let error;
      try {
        const res = await supabase.from("tournament_registrations").delete().eq("tournament_type", "tekken").eq("user_id", user_id);
        error = res.error;
        if (error && error.message.includes("tournament_type")) throw error;
      } catch {
        const res = await supabase.from("tournament_registrations").delete().eq("user_id", user_id);
        error = res.error;
      }
      if (error) return Response.json({ error: error.message }, { status: 500 });
      return Response.json({ success: true });
    }

    // NBA unregister — block if tournament already started (16 + matches exist)
    try {
      const { count } = await supabase.from("tournament_registrations").select("*", { count: "exact", head: true }).eq("tournament_type", "nba");
      if (count === MAX_NBA_PLAYERS) {
        const { data: matches } = await supabase.from("tournament_matches").select("match_id").eq("tournament_type", "nba").limit(1);
        if (matches && matches.length > 0) {
          return Response.json({ error: "Tournament already started — cannot unregister after bracket generated (16 teams complete)" }, { status: 400 });
        }
      }
    } catch {}

    let error;
    try {
      const res = await supabase.from("tournament_registrations").delete().eq("tournament_type", "nba").eq("user_id", user_id);
      error = res.error;
      if (error && error.message.includes("tournament_type")) throw error;
    } catch {
      const res = await supabase.from("tournament_registrations").delete().eq("user_id", user_id);
      error = res.error;
    }

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // If we went back below 16, clean up any scheduled (not completed) matches
    try {
      const { count } = await supabase.from("tournament_registrations").select("*", { count: "exact", head: true }).eq("tournament_type", "nba");
      if (count != null && count < MAX_NBA_PLAYERS) {
        await supabase.from("tournament_matches").delete().eq("tournament_type", "nba").eq("status", "scheduled");
      }
    } catch {}

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: string }).message) : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}



