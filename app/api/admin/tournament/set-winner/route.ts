import { randomInt } from "crypto";
import { supabase } from "@/lib/supabase";
import {
  advanceBracket,
  resetMatchAndDownstream,
  buildSeriesGames,
  gameUnlocked,
  syncSeriesResult,
  tallySeries,
  seriesWinnerFromTally,
  type NbaGameRow,
  type NbaMatchRow,
} from "@/lib/tournament/nba-advance";
import { NBA_TEAMS, TEAM_CONFERENCES } from "@/lib/constants/nba";
import { ActivityLogRepository } from "@/lib/repositories/ActivityLogRepository";

// Default requested semifinal pairings (admin override):
//   West: Warriors vs Blazers, East: Pacers vs Knicks.
// Order here matches the current persisted rows so re-running is a no-op
// (matchup equality is order-insensitive — see forceSemifinals).
const DEFAULT_FORCE_SEMIFINALS = [
  { conference: "West", team1: "Golden State Warriors", team2: "Portland Trail Blazers" },
  { conference: "East", team1: "Indiana Pacers", team2: "New York Knicks" },
] as const;

const activityLog = new ActivityLogRepository();

async function verifyAdmin(adminId: unknown): Promise<boolean> {
  // Frontend gates via localStorage.isAdmin; server verifies when admin_id supplied.
  // Keep permissive when absent to match existing admin API patterns (e.g. /api/admin/load).
  if (!adminId || typeof adminId !== "string") return true;
  try {
    const { data } = await supabase.from("users").select("is_admin").eq("id", adminId).maybeSingle();
    if (data && (data as { is_admin?: boolean }).is_admin === false) return false;
    return true;
  } catch {
    return true;
  }
}

function actorId(actor: unknown): string | null {
  return typeof actor === "string" && actor.length > 20 ? actor : null;
}

async function fetchGames(matchId?: string): Promise<NbaGameRow[]> {
  try {
    let q = supabase
      .from("tournament_games")
      .select("*")
      .eq("tournament_type", "nba")
      .order("game_number", { ascending: true });
    if (matchId) q = q.eq("match_id", matchId);
    const { data, error } = await q;
    if (error) return [];
    return ((data as NbaGameRow[]) || []).filter(Boolean);
  } catch {
    // Table may not exist yet if migration hasn't been applied
    return [];
  }
}

// GET /api/admin/tournament/set-winner?round=all — admin list view (all rounds, ordered)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const round = searchParams.get("round") || "all";
    let query = supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_type", "nba");
    if (round !== "all") query = query.eq("round", round);
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const matches = data || [];
    const completed = matches.filter((m: { status?: string }) => m.status === "completed").length;
    const championRow = matches.find((m: { match_id?: string }) => m.match_id === "nba-r4-final");
    const champion =
      championRow?.status === "completed" ? (championRow as { winner?: string }).winner ?? null : null;
    const games = await fetchGames();
    // Player names: join users for team/winner/home user_ids (one query)
    let users: Record<string, string> = {};
    try {
      const ids = Array.from(
        new Set(
          [
            ...matches.flatMap((m: { team1_user_id?: string | null; team2_user_id?: string | null; winner_user_id?: string | null }) => [
              m.team1_user_id,
              m.team2_user_id,
              m.winner_user_id,
            ]),
            ...games.flatMap((g) => [g.home_user_id, g.winner_user_id]),
          ].filter(Boolean) as string[]
        )
      );
      if (ids.length > 0) {
        const { data: udata } = await supabase.from("users").select("id, name").in("id", ids);
        users = Object.fromEntries(((udata as { id: string; name: string }[]) || []).map((u) => [u.id, u.name]));
      }
    } catch {}
    const championUserId = (championRow as { winner_user_id?: string | null } | undefined)?.winner_user_id ?? null;
    const championName = championUserId && users[championUserId] ? users[championUserId] : null;
    return Response.json({ matches, games, completed, total: matches.length, champion, championName, users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

// POST /api/admin/tournament/set-winner
// Series (legacy/direct): { match_id, winner } → complete series + auto-advance
// Series reset: { match_id, action: "reset" }
// Best-of-5: { match_id, action: "coin_toss" } → decide Player A, create G1-G5
// Game result: { match_id, game_number, winner } → set game winner, clinch at 3
// Game reset: { match_id, game_number, action: "reset" } → clear game N + later games
// Reset all: { action: "reset_all" }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { match_id, matchId, winner, action, admin_id, adminId, scheduled_date, game_number, gameNumber } = body;
    const id: string | undefined = match_id || matchId;
    const gnum: number | undefined =
      game_number !== undefined ? Number(game_number) : gameNumber !== undefined ? Number(gameNumber) : undefined;

    const ok = await verifyAdmin(admin_id ?? adminId);
    if (!ok) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    const actor = (admin_id ?? adminId ?? "Admin") as string;

    // ---- RESET ALL (results-only: players + First Round pairings untouched) ----
    if (action === "reset_all") {
      try {
        await supabase.from("tournament_games").delete().eq("tournament_type", "nba");
      } catch {}
      const { error: delErr, count: deletedCount } = await supabase
        .from("tournament_matches")
        .delete({ count: "exact" })
        .eq("tournament_type", "nba")
        .in("round", ["Semifinals", "Conference Finals", "Finals"]);
      if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

      const { error: clearErr, count: resetCount } = await supabase
        .from("tournament_matches")
        .update(
          { winner: null, winner_user_id: null, loser: null, status: "scheduled" },
          { count: "exact" }
        )
        .eq("tournament_type", "nba")
        .eq("round", "First Round");
      if (clearErr) return Response.json({ error: clearErr.message }, { status: 500 });

      void activityLog.log({
        actor_id: actorId(actor),
        actor_name: "Admin",
        actor_role: "admin",
        action: "tournament_reset_all",
        target_type: "tournament",
        target_id: "nba",
        details: { clearedDownstream: deletedCount ?? 0, resetFirstRound: resetCount ?? 0 },
      });
      return Response.json({
        success: true,
        resetAll: true,
        clearedDownstream: deletedCount ?? 0,
        resetFirstRound: resetCount ?? 0,
      });
    }

    // ---- FORCE SEMIFINALS (admin override: set SF pairings directly) ----
    // Body: { action: "force_semifinal", semifinals?: [{conference, team1, team2}], clear_other_sf?: boolean }
    // Defaults to Warriors-Blazers (West) + Pacers-Knicks (East) when omitted.
    // First Round rows are left untouched. Touched SFs are reset to scheduled
    // (toss + games wiped) and stale downstream CF/Final rows are cleared.
    if (action === "force_semifinal" || action === "force_semifinals") {
      return await forceSemifinals(body, actor);
    }

    if (!id) {
      return Response.json({ error: "match_id is required" }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("match_id", id)
      .maybeSingle();
    if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });
    if (!existing) {
      return Response.json(
        { error: `Match ${id} not found — it is created automatically once its source games complete` },
        { status: 404 }
      );
    }
    const m = existing as NbaMatchRow & {
      team1: string | null;
      team2: string | null;
      team1_user_id: string | null;
      team2_user_id: string | null;
      winner: string | null;
    };

    // ---- COIN TOSS: decide Player A (hosts G1/G3/G5), create G1-G5 ----
    if (action === "coin_toss") {
      if (!m.team1 || !m.team2) {
        return Response.json({ error: "Both teams must be known before the coin toss" }, { status: 400 });
      }
      const games = await fetchGames(id);
      if (games.some((g) => g.status === "completed")) {
        return Response.json({ error: "Homecourt locked — games already played in this series" }, { status: 400 });
      }
      // Manual pick: admin sets who is Player A. Falls back to random if not provided.
      const { player_a, playerA } = body as { player_a?: unknown; playerA?: unknown };
      const picked = typeof player_a === "string" ? player_a : typeof playerA === "string" ? playerA : null;
      let playerAChoice: string;
      if (picked) {
        if (picked !== m.team1 && picked !== m.team2) {
          return Response.json({ error: "player_a must be one of the two teams in this series" }, { status: 400 });
        }
        playerAChoice = picked;
      } else {
        playerAChoice = randomInt(2) === 0 ? (m.team1 as string) : (m.team2 as string);
      }
      const { error: tossErr } = await supabase
        .from("tournament_matches")
        .update({ player_a_team: playerAChoice })
        .eq("match_id", id);
      if (tossErr) {
        const msg = /player_a_team|column/i.test(tossErr.message)
          ? "Database migration missing — apply 20260909000000_nba_best_of_five.sql first"
          : tossErr.message;
        return Response.json({ error: msg }, { status: 500 });
      }
      try {
        await supabase.from("tournament_games").delete().eq("match_id", id);
      } catch {}
      const rows = buildSeriesGames({ ...m, player_a_team: playerAChoice }, playerAChoice);
      const { error: insErr } = await supabase.from("tournament_games").insert(rows);
      if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

      void activityLog.log({
        actor_id: actorId(actor),
        actor_name: "Admin",
        actor_role: "admin",
        action: "tournament_coin_toss",
        target_type: "tournament_match",
        target_id: id,
        details: { playerA: playerAChoice, manual: Boolean(picked), hosts: "G1/G3/G5" },
      });
      return Response.json({ success: true, coinToss: true, playerA: playerAChoice, manual: Boolean(picked), games: rows });
    }

    // ---- GAME RESULT: set winner for one game in the series ----
    if (gnum !== undefined && (winner || action === "set_game")) {
      return await setGameWinner(id, m, gnum, winner, actor);
    }

    // ---- GAME RESET: clear game N + later games in the series ----
    if (gnum !== undefined && (action === "reset" || winner === null)) {
      return await resetGame(id, m, gnum, actor);
    }

    // ---- SERIES RESET (clears games too; toss result kept so games replay as-is) ----
    if (action === "reset" || winner === null) {
      const { error: resetErr } = await supabase
        .from("tournament_matches")
        .update({ winner: null, winner_user_id: null, loser: null, status: "scheduled" })
        .eq("match_id", id);
      if (resetErr) return Response.json({ error: resetErr.message }, { status: 500 });
      try {
        await supabase.from("tournament_games").delete().eq("match_id", id);
      } catch {}

      const { deletedStale, updatedDownstream } = await resetMatchAndDownstream(supabase, id);
      void activityLog.log({
        actor_id: actorId(actor),
        actor_name: "Admin",
        actor_role: "admin",
        action: "tournament_reset",
        target_type: "tournament_match",
        target_id: id,
        details: { deletedStale, updatedDownstream },
      });
      return Response.json({ success: true, reset: true, deletedStale, updatedDownstream });
    }

    // ---- SERIES SET WINNER (direct/legacy: complete the series at once) ----
    if (!winner || typeof winner !== "string") {
      return Response.json({ error: "winner is required (or action: reset)" }, { status: 400 });
    }
    if (!m.team1 || !m.team2) {
      return Response.json({ error: "Awaiting opponent — both semifinalists must be known first" }, { status: 400 });
    }
    if (winner !== m.team1 && winner !== m.team2) {
      return Response.json({ error: "winner must be one of the two teams in this match" }, { status: 400 });
    }

    const isTeam1 = winner === m.team1;
    const loser = isTeam1 ? m.team2 : m.team1;
    const winner_user_id = isTeam1 ? m.team1_user_id : m.team2_user_id;

    const updatePayload: Record<string, unknown> = {
      winner,
      loser,
      winner_user_id: winner_user_id ?? null,
      status: "completed",
    };
    if (scheduled_date) updatePayload.scheduled_date = scheduled_date;

    const { error: updateErr } = await supabase
      .from("tournament_matches")
      .update(updatePayload)
      .eq("match_id", id);
    if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

    const { createdNext, deletedStale } = await advanceBracket(supabase, id);

    void activityLog.log({
      actor_id: actorId(actor),
      actor_name: "Admin",
      actor_role: "admin",
      action: "tournament_set_winner",
      target_type: "tournament_match",
      target_id: id,
      details: { winner, loser, createdNext, deletedStale },
    });

    const champion = id === "nba-r4-final" ? winner : null;

    return Response.json({ success: true, match_id: id, winner, loser, createdNext, deletedStale, champion });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

async function setGameWinner(
  id: string,
  m: NbaMatchRow & { team1: string | null; team2: string | null; team1_user_id: string | null; team2_user_id: string | null },
  gnum: number,
  winner: unknown,
  actor: string
) {
  if (!winner || typeof winner !== "string") {
    return Response.json({ error: "winner is required" }, { status: 400 });
  }
  if (winner !== m.team1 && winner !== m.team2) {
    return Response.json({ error: "winner must be one of the two teams in this series" }, { status: 400 });
  }
  if (!Number.isInteger(gnum) || gnum < 1 || gnum > 5) {
    return Response.json({ error: "game_number must be 1-5" }, { status: 400 });
  }
  if (!(m as { player_a_team?: string | null }).player_a_team) {
    return Response.json({ error: "Set homecourt first (pick who hosts G1/G3/G5)" }, { status: 400 });
  }

  const games = await fetchGames(id);
  const byNum = new Map(games.map((g) => [g.game_number, g]));
  const existing = byNum.get(gnum);
  const isOverride = existing?.status === "completed";
  if (!isOverride) {
    const unlock = gameUnlocked(games, gnum, m.team1, m.team2);
    if (!unlock.ok) return Response.json({ error: unlock.reason }, { status: 400 });
  } else if (m.status === "completed") {
    // Overriding a game inside a decided series — downstream will be reconciled below
  }
  if (!existing) {
    return Response.json({ error: "Games not created yet — set homecourt first" }, { status: 400 });
  }

  const winner_user_id = winner === m.team1 ? (m.team1_user_id ?? null) : (m.team2_user_id ?? null);
  const { error: updErr } = await supabase
    .from("tournament_games")
    .update({ winner, winner_user_id, status: "completed" })
    .eq("match_id", id)
    .eq("game_number", gnum);
  if (updErr) return Response.json({ error: updErr.message }, { status: 500 });

  const fresh = await fetchGames(id);
  const tally = tallySeries(fresh, m.team1, m.team2);
  const sync = await syncSeriesResult(supabase, m, fresh);

  let createdNext: string[] = [];
  let deletedStale: string[] = [];
  let champion: string | null = null;
  if (sync.changed && sync.clinched) {
    const adv = await advanceBracket(supabase, id);
    createdNext = adv.createdNext;
    deletedStale = adv.deletedStale;
    if (id === "nba-r4-final") champion = sync.winner;
  } else if (sync.changed && !sync.clinched && sync.reopened) {
    const rec = await resetMatchAndDownstream(supabase, id);
    deletedStale = rec.deletedStale;
  }

  void activityLog.log({
    actor_id: actorId(actor),
    actor_name: "Admin",
    actor_role: "admin",
    action: "tournament_set_game_winner",
    target_type: "tournament_match",
    target_id: id,
    details: { game: gnum, winner, tally, createdNext, deletedStale },
  });

  const seriesWinner = seriesWinnerFromTally(tally, m.team1, m.team2);
  return Response.json({
    success: true,
    match_id: id,
    game: gnum,
    winner,
    tally,
    seriesWinner,
    createdNext,
    deletedStale,
    champion,
  });
}

async function resetGame(
  id: string,
  m: NbaMatchRow & { team1: string | null; team2: string | null },
  gnum: number,
  actor: string
) {
  if (!Number.isInteger(gnum) || gnum < 1 || gnum > 5) {
    return Response.json({ error: "game_number must be 1-5" }, { status: 400 });
  }
  // Clearing game N also clears later games (they were played out of order otherwise)
  const { error: clrErr } = await supabase
    .from("tournament_games")
    .update({ winner: null, winner_user_id: null, status: "scheduled" })
    .eq("match_id", id)
    .gte("game_number", gnum);
  if (clrErr) return Response.json({ error: clrErr.message }, { status: 500 });

  const fresh = await fetchGames(id);
  const tally = tallySeries(fresh, m.team1, m.team2);
  const sync = await syncSeriesResult(supabase, m, fresh);

  let deletedStale: string[] = [];
  if (sync.changed && !sync.clinched && sync.reopened) {
    const rec = await resetMatchAndDownstream(supabase, id);
    deletedStale = rec.deletedStale;
  }

  void activityLog.log({
    actor_id: actorId(actor),
    actor_name: "Admin",
    actor_role: "admin",
    action: "tournament_reset_game",
    target_type: "tournament_match",
    target_id: id,
    details: { clearedFromGame: gnum, tally, deletedStale },
  });

  return Response.json({ success: true, resetGame: true, clearedFromGame: gnum, tally, deletedStale });
}

type ForceSemifinalInput = {
  conference: string;
  team1: string;
  team2: string;
  slot?: string;
};

function isTbd(v: unknown) {
  if (v == null) return true;
  if (typeof v !== "string") return false;
  const t = v.trim().toLowerCase();
  return t === "" || t === "tbd" || t === "null" || t === "none" || t === "?" ;
}

function sameTeamSet(a1: string | null, a2: string | null, b1: string | null, b2: string | null) {
  // Partial (TBD) rows compare ordered; full rows compare as sets (order-insensitive).
  if (!b1 || !b2) return a1 === b1 && a2 === b2;
  const a = [a1, a2].filter(Boolean).sort();
  const b = [b1, b2].sort();
  return a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1];
}

async function forceSemifinals(body: Record<string, unknown>, actor: string) {
  const raw =
    (body.semifinals as ForceSemifinalInput[] | undefined) ??
    (body.matchups as ForceSemifinalInput[] | undefined) ??
    (body.pairings as ForceSemifinalInput[] | undefined) ??
    [...DEFAULT_FORCE_SEMIFINALS];
  const clearOtherSf = body.clear_other_sf !== false && body.clearOtherSf !== false;

  if (!Array.isArray(raw) || raw.length === 0) {
    return Response.json({ error: "semifinals array is required" }, { status: 400 });
  }

  // Normalize + validate conferences. team2 may be TBD (null) for partial
  // slots awaiting a First Round winner (e.g. 76ers vs winner of Heat/Wizards).
  // Optional slot: "sf1" (default) or "sf2".
  const inputs: { conference: string; team1: string; team2: string | null; slot: string }[] = [];
  for (const s of raw) {
    const conference =
      typeof (s as { conference?: unknown }).conference === "string"
        ? ((s as { conference: string }).conference.trim().toLowerCase() === "west" ? "West" : "East")
        : null;
    const team1 = typeof (s as { team1?: unknown }).team1 === "string" ? ((s as { team1: string }).team1.trim() as string) : "";
    const rawT2 = (s as { team2?: unknown }).team2;
    const team2 = isTbd(rawT2) ? null : String(rawT2).trim();
    const slotRaw = typeof (s as { slot?: unknown }).slot === "string" ? ((s as { slot: string }).slot.trim().toLowerCase()) : "sf1";
    const slot = slotRaw === "sf2" ? "sf2" : "sf1";
    if (!conference || !team1) {
      return Response.json({ error: "Each semifinal needs { conference: East|West, team1, team2? (TBD allowed), slot?: sf1|sf2 }" }, { status: 400 });
    }
    if (team2 && team1 === team2) {
      return Response.json({ error: `Invalid semifinal (${conference}): team1 and team2 must differ` }, { status: 400 });
    }
    for (const t of [team1, ...(team2 ? [team2] : [])]) {
      if (!(NBA_TEAMS as readonly string[]).includes(t)) {
        return Response.json({ error: `Invalid team name: ${t}` }, { status: 400 });
      }
      const realConf = TEAM_CONFERENCES[t]?.conference;
      if (realConf && realConf !== conference) {
        return Response.json(
          { error: `${t} is a ${realConf} team — cannot be forced into ${conference} semifinals` },
          { status: 400 }
        );
      }
    }
    inputs.push({ conference, team1, team2, slot });
  }
  // One entry per conference+slot max
  const seen = new Set<string>();
  for (const s of inputs) {
    const key = `${s.conference}:${s.slot}`;
    if (seen.has(key)) {
      return Response.json({ error: `Duplicate semifinal for ${s.conference} ${s.slot} — one per slot` }, { status: 400 });
    }
    seen.add(key);
  }

  // Registrations -> user_ids (all forced non-TBD teams must be registered)
  const allTeams = Array.from(new Set(inputs.flatMap((s) => (s.team2 ? [s.team1, s.team2] : [s.team1]))));
  const { data: regs, error: regErr } = await supabase
    .from("tournament_registrations")
    .select("user_id, team, created_at")
    .eq("tournament_type", "nba")
    .in("team", allTeams);
  if (regErr) return Response.json({ error: regErr.message }, { status: 500 });
  const regByTeam = new Map(((regs as { user_id: string; team: string; created_at: string }[]) || []).map((r) => [r.team, r]));
  const missing = allTeams.filter((t) => !regByTeam.has(t));
  if (missing.length > 0) {
    return Response.json(
      { error: `Teams not registered for NBA tournament: ${missing.join(", ")} — register them first (1 player = 1 team)` },
      { status: 400 }
    );
  }

  // Seeds: prefer First Round seed, fallback to registration order within conference
  const seedByTeam = new Map<string, number>();
  try {
    const { data: r1 } = await supabase
      .from("tournament_matches")
      .select("team1,team2,seed1,seed2")
      .eq("tournament_type", "nba")
      .eq("round", "First Round");
    for (const m of ((r1 as { team1: string | null; team2: string | null; seed1: number | null; seed2: number | null }[]) || [])) {
      if (m.team1 && m.seed1 != null && !seedByTeam.has(m.team1)) seedByTeam.set(m.team1, m.seed1);
      if (m.team2 && m.seed2 != null && !seedByTeam.has(m.team2)) seedByTeam.set(m.team2, m.seed2);
    }
  } catch {}
  // Fallback: registration order per conference (earliest = seed 1)
  for (const conf of ["East", "West"] as const) {
    try {
      const { data: confRegs } = await supabase
        .from("tournament_registrations")
        .select("team, created_at")
        .eq("tournament_type", "nba")
        .order("created_at", { ascending: true });
      const list = (((confRegs as { team: string; created_at: string }[]) || []).filter(
        (r) => TEAM_CONFERENCES[r.team]?.conference === conf
      ) as { team: string }[]);
      list.forEach((r, i) => {
        if (!seedByTeam.has(r.team)) seedByTeam.set(r.team, i + 1);
      });
    } catch {}
  }

  const forced: string[] = [];
  const skipped: string[] = [];
  const deletedStale: string[] = [];
  const clearedGames: string[] = [];

  for (const s of inputs) {
    const c = s.conference.toLowerCase();
    const targetId = `nba-r2-${c}-${s.slot}`;
    const otherId = s.slot === "sf1" ? `nba-r2-${c}-sf2` : `nba-r2-${c}-sf1`;
    const cfId = `nba-r3-${c}-cf`;
    const label2 = s.team2 ?? "TBD";

    const { data: existing } = await supabase
      .from("tournament_matches")
      .select("match_id,team1,team2,status")
      .eq("match_id", targetId)
      .maybeSingle();
    const cur = existing as { match_id: string; team1: string | null; team2: string | null; status: string | null } | null;

    // Idempotent: same teams (TBD-aware) -> keep existing row untouched
    // (preserves toss/games + downstream CF that may already reference it).
    if (cur && sameTeamSet(cur.team1, cur.team2, s.team1, s.team2)) {
      skipped.push(targetId);
    } else {
      // Wipe toss/games for the target slot before overwriting
      try {
        await supabase.from("tournament_games").delete().eq("match_id", targetId);
        clearedGames.push(targetId);
      } catch {}
      const row = {
        match_id: targetId,
        tournament_type: "nba",
        round: "Semifinals",
        conference: s.conference,
        seed1: seedByTeam.get(s.team1) ?? null,
        seed2: s.team2 ? (seedByTeam.get(s.team2) ?? null) : null,
        team1: s.team1,
        team2: s.team2,
        team1_user_id: regByTeam.get(s.team1)?.user_id ?? null,
        team2_user_id: s.team2 ? (regByTeam.get(s.team2)?.user_id ?? null) : null,
        status: "scheduled",
        winner: null,
        winner_user_id: null,
        loser: null,
        player_a_team: null,
      };
      if (cur) {
        const { error: updErr } = await supabase
          .from("tournament_matches")
          .update(row)
          .eq("match_id", targetId);
        if (updErr) return Response.json({ error: updErr.message }, { status: 500 });
      } else {
        const { error: insErr } = await supabase.from("tournament_matches").insert(row);
        if (insErr) return Response.json({ error: insErr.message }, { status: 500 });
      }
      forced.push(`${targetId} (${s.team1} vs ${label2})`);
    }

    const targetChanged = forced.some((f) => f.startsWith(targetId));

    // Clear the sibling SF slot only for sf1 entries when requested AND this
    // conference's SF actually changed. Skipped (already-correct) targets
    // must not destroy the sibling semifinal (e.g. West sf2 OKC win stays
    // when West sf1 Warriors-Blazers is already correct). sf2 entries never
    // delete their sibling.
    if (clearOtherSf && targetChanged && s.slot === "sf1") {
      const { data: other } = await supabase
        .from("tournament_matches")
        .select("match_id,status")
        .eq("match_id", otherId)
        .maybeSingle();
      if (other) {
        try {
          await supabase.from("tournament_games").delete().eq("match_id", otherId);
          clearedGames.push(otherId);
        } catch {}
        await supabase.from("tournament_matches").delete().eq("match_id", otherId);
        deletedStale.push(otherId);
      }
    }

    // Downstream CF + Final are stale once this conference's SF picture changes.
    // (CF only exists once an SF winner is known; Final once a CF winner is known.
    // Deleting scheduled partials here is safe — they rebuild on next winner.)
    if (targetChanged || deletedStale.includes(otherId)) {
      try {
        await supabase.from("tournament_games").delete().eq("match_id", cfId);
      } catch {}
      const { data: cf } = await supabase
        .from("tournament_matches")
        .select("match_id")
        .eq("match_id", cfId)
        .maybeSingle();
      if (cf) {
        await supabase.from("tournament_matches").delete().eq("match_id", cfId);
        deletedStale.push(cfId);
      }
      try {
        await supabase.from("tournament_games").delete().eq("match_id", "nba-r4-final");
      } catch {}
      const { data: fin } = await supabase
        .from("tournament_matches")
        .select("match_id")
        .eq("match_id", "nba-r4-final")
        .maybeSingle();
      if (fin) {
        await supabase.from("tournament_matches").delete().eq("match_id", "nba-r4-final");
        if (!deletedStale.includes("nba-r4-final")) deletedStale.push("nba-r4-final");
      }
    }
  }

  void activityLog.log({
    actor_id: actorId(actor),
    actor_name: "Admin",
    actor_role: "admin",
    action: "tournament_force_semifinal",
    target_type: "tournament",
    target_id: "nba",
    details: { forced, skipped, deletedStale, clearedGames, clearOtherSf },
  });

  return Response.json({ success: true, forced, skipped, deletedStale, clearedGames });
}
