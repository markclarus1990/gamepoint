// NBA bracket advancement engine — single source of truth for auto-progression.
// Format (15 matches total):
//   First Round (8):  nba-r1-{east|west}-{1v8,4v5,3v6,2v7}
//   Semifinals (4):   nba-r2-{east|west}-sf1  = W(1v8) vs W(4v5)
//                     nba-r2-{east|west}-sf2  = W(3v6) vs W(2v7)
//   Conf Finals (2):  nba-r3-{east|west}-cf   = W(sf1) vs W(sf2)
//   Finals (1):       nba-r4-final            = W(east-cf) vs W(west-cf)
// Champion = Finals winner.

import type { SupabaseClient } from "@supabase/supabase-js";

export type NbaMatchRow = {
  match_id: string;
  tournament_type?: string | null;
  round: string | null;
  conference: string | null;
  seed1: number | null;
  seed2: number | null;
  team1: string | null;
  team2: string | null;
  team1_user_id: string | null;
  team2_user_id: string | null;
  player_a_team?: string | null;
  winner: string | null;
  winner_user_id: string | null;
  loser: string | null;
  status: string | null;
  scheduled_date?: string | null;
};

export type NbaGameRow = {
  id?: string;
  match_id: string;
  tournament_type?: string | null;
  game_number: number;
  home_team: string | null;
  home_user_id: string | null;
  winner: string | null;
  winner_user_id: string | null;
  status: string | null;
  scheduled_date?: string | null;
};

// ---- Best-of-5 series ----
// Player A (coin toss) hosts G1/G3/G5, Player B hosts G2/G4. First to 3 wins.
export const SERIES_CLINCH_WINS = 3;
export const SERIES_MAX_GAMES = 5;

function homeSideForGame(gameNumber: number): "A" | "B" {
  return gameNumber === 2 || gameNumber === 4 ? "B" : "A";
}

export function homeTeamForGame(
  gameNumber: number,
  playerA: string,
  playerB: string
): string {
  return homeSideForGame(gameNumber) === "A" ? playerA : playerB;
}

/** Build the 5 scheduled game rows for a series once Player A is known. */
export function buildSeriesGames(match: NbaMatchRow, playerA: string) {
  const playerB =
    match.team1 === playerA ? (match.team2 as string) : (match.team1 as string);
  const userFor = (team: string | null) =>
    team === match.team1 ? (match.team1_user_id ?? null) : (match.team2_user_id ?? null);
  return [1, 2, 3, 4, 5].map((n) => {
    const home = homeTeamForGame(n, playerA, playerB);
    return {
      match_id: match.match_id,
      tournament_type: "nba",
      game_number: n,
      home_team: home,
      home_user_id: userFor(home),
      status: "scheduled",
    };
  });
}

export function tallySeries(
  games: NbaGameRow[],
  team1: string | null,
  team2: string | null
): { wins1: number; wins2: number; played: number } {
  let wins1 = 0;
  let wins2 = 0;
  let played = 0;
  for (const g of games) {
    if (g.status === "completed" && g.winner) {
      played++;
      if (g.winner === team1) wins1++;
      else if (g.winner === team2) wins2++;
    }
  }
  return { wins1, wins2, played };
}

/** Series winner = first to 3, else null. */
export function seriesWinnerFromTally(
  tally: { wins1: number; wins2: number },
  team1: string | null,
  team2: string | null
): string | null {
  if (team1 && tally.wins1 >= SERIES_CLINCH_WINS) return team1;
  if (team2 && tally.wins2 >= SERIES_CLINCH_WINS) return team2;
  return null;
}

/**
 * Can a winner be recorded for `gameNumber` right now?
 * Rules: no skipping (previous game must be completed), G5 only at 2-2,
 * nothing after a clinch.
 */
export function gameUnlocked(
  games: NbaGameRow[],
  gameNumber: number,
  team1: string | null,
  team2: string | null
): { ok: boolean; reason?: string } {
  if (gameNumber < 1 || gameNumber > SERIES_MAX_GAMES) {
    return { ok: false, reason: "game_number must be 1-5" };
  }
  const byNum = new Map(games.map((g) => [g.game_number, g]));
  const tally = tallySeries(games, team1, team2);
  if (seriesWinnerFromTally(tally, team1, team2)) {
    return { ok: false, reason: "Series already decided — override a game result to reopen" };
  }
  for (let n = 1; n < gameNumber; n++) {
    const prev = byNum.get(n);
    if (!prev || prev.status !== "completed") {
      return { ok: false, reason: `Play Game ${n} first` };
    }
  }
  if (gameNumber === 5 && !(tally.wins1 === 2 && tally.wins2 === 2)) {
    return { ok: false, reason: "Game 5 only if tied 2-2" };
  }
  return { ok: true };
}

/**
 * Reconcile the series row with its games. Sets/clears the series winner.
 * Returns what changed so the caller can advance or cascade.
 */
export async function syncSeriesResult(
  db: SupabaseClient,
  match: NbaMatchRow,
  games: NbaGameRow[]
): Promise<
  | { changed: false }
  | { changed: true; clinched: true; winner: string; winner_user_id: string | null; loser: string | null }
  | { changed: true; clinched: false; reopened: boolean }
> {
  const tally = tallySeries(games, match.team1, match.team2);
  const winner = seriesWinnerFromTally(tally, match.team1, match.team2);

  if (winner) {
    const winner_user_id =
      winner === match.team1 ? (match.team1_user_id ?? null) : (match.team2_user_id ?? null);
    const loser = winner === match.team1 ? match.team2 : match.team1;
    if (match.status === "completed" && match.winner === winner) {
      return { changed: false };
    }
    await db
      .from("tournament_matches")
      .update({ winner, winner_user_id, loser, status: "completed" })
      .eq("match_id", match.match_id);
    return { changed: true, clinched: true, winner, winner_user_id, loser };
  }

  // No clinch — reopen a previously completed (legacy or overridden) series
  if (match.status === "completed") {
    await db
      .from("tournament_matches")
      .update({ winner: null, winner_user_id: null, loser: null, status: "scheduled" })
      .eq("match_id", match.match_id);
    return { changed: true, clinched: false, reopened: true };
  }
  return { changed: false };
}

export const R1_IDS = (conf: "East" | "West") => {
  const c = conf.toLowerCase();
  return [
    `nba-r1-${c}-1v8`,
    `nba-r1-${c}-4v5`,
    `nba-r1-${c}-3v6`,
    `nba-r1-${c}-2v7`,
  ];
};

export const SF_IDS = (conf: "East" | "West") => {
  const c = conf.toLowerCase();
  return [`nba-r2-${c}-sf1`, `nba-r2-${c}-sf2`];
};

export const CF_ID = (conf: "East" | "West") => `nba-r3-${conf.toLowerCase()}-cf`;
export const FINAL_ID = "nba-r4-final";

// ---- Admin-forced East semifinal slots (custom bracket, not natural feeders) ----
// Natural mapping is sf1 = W(1v8) vs W(4v5), sf2 = W(3v6) vs W(2v7).
// Admin requested instead (76ers/Knicks swapped):
//   east-sf1 = Pacers (2v7 side) vs 76ers (1v8 winner) — full forced row.
//   east-sf2 = Knicks (4v5 winner) vs Heat (custom — forced over the 3v6 winner).
// The guards below keep auto-progression from clobbering these rows:
//   - east-sf1 is preserved as-is (never overwritten by natural W1v8 vs W4v5).
//   - east-sf2 keeps Knicks anchored; its pairing is preserved as-is once filled.
export const FORCED_EAST_SF1_TEAMS = ["Indiana Pacers", "Philadelphia 76ers"] as const;
export const FORCED_EAST_SF2_ANCHOR = "New York Knicks";

function teamSet2(a1: string | null, a2: string | null) {
  return [a1, a2].filter(Boolean).sort();
}

/** True when a scheduled row is the forced Pacers-vs-76ers east-sf1. */
export function isForcedEastSf1(matchId: string, team1: string | null, team2: string | null) {
  if (matchId !== "nba-r2-east-sf1") return false;
  const s = teamSet2(team1, team2);
  return s.length === 2 && s[0] === "Indiana Pacers" && s[1] === "Philadelphia 76ers";
}

/** True when a scheduled row is the forced Knicks-anchored east-sf2 (other side TBD or filled). */
export function isForcedEastSf2(matchId: string, team1: string | null, team2: string | null) {
  if (matchId !== "nba-r2-east-sf2") return false;
  return team1 === FORCED_EAST_SF2_ANCHOR || team2 === FORCED_EAST_SF2_ANCHOR;
}

type Participant = {
  team: string;
  user_id: string | null;
  seed: number | null;
};

function winnerOf(m: NbaMatchRow): Participant | null {
  if (!m.winner) return null;
  if (m.winner === m.team1) {
    return { team: m.team1 as string, user_id: m.team1_user_id ?? null, seed: m.seed1 ?? null };
  }
  if (m.winner === m.team2) {
    return { team: m.team2 as string, user_id: m.team2_user_id ?? null, seed: m.seed2 ?? null };
  }
  return null;
}

function byId(matches: NbaMatchRow[]) {
  return new Map(matches.map((m) => [m.match_id, m]));
}

/**
 * Given ALL nba matches, compute which next-round rows should exist / be updated.
 * Returns upserts (scheduled rows with participants) — caller decides to write them.
 * Never overwrites a completed downstream match's winner; caller must handle cascade first.
 */
export function computeNextRoundUpserts(all: NbaMatchRow[]) {
  const map = byId(all);
  const upserts: Record<string, unknown>[] = [];

  for (const conf of ["East", "West"] as const) {
    const [id1v8, id4v5, id3v6, id2v7] = R1_IDS(conf);
    const [sf1Id, sf2Id] = SF_IDS(conf);
    const cfId = CF_ID(conf);

    const m1v8 = map.get(id1v8);
    const m4v5 = map.get(id4v5);
    const m3v6 = map.get(id3v6);
    const m2v7 = map.get(id2v7);

    // Semifinals populate as soon as EITHER feeder is decided —
    // the missing side stays null (TBD) until its series completes.
    const w1v8 = m1v8 ? winnerOf(m1v8) : null;
    const w4v5 = m4v5 ? winnerOf(m4v5) : null;
    const w3v6 = m3v6 ? winnerOf(m3v6) : null;
    const w2v7 = m2v7 ? winnerOf(m2v7) : null;

    if (w1v8 || w4v5) {
      upserts.push({
        match_id: sf1Id,
        tournament_type: "nba",
        round: "Semifinals",
        conference: conf,
        seed1: w1v8?.seed ?? null,
        seed2: w4v5?.seed ?? null,
        team1: w1v8?.team ?? null,
        team2: w4v5?.team ?? null,
        team1_user_id: w1v8?.user_id ?? null,
        team2_user_id: w4v5?.user_id ?? null,
        status: "scheduled",
      });
    }
    if (w3v6 || w2v7) {
      upserts.push({
        match_id: sf2Id,
        tournament_type: "nba",
        round: "Semifinals",
        conference: conf,
        seed1: w3v6?.seed ?? null,
        seed2: w2v7?.seed ?? null,
        team1: w3v6?.team ?? null,
        team2: w2v7?.team ?? null,
        team1_user_id: w3v6?.user_id ?? null,
        team2_user_id: w2v7?.user_id ?? null,
        status: "scheduled",
      });
    }

    const sf1 = map.get(sf1Id);
    const sf2 = map.get(sf2Id);
    const wSf1 = sf1 ? winnerOf(sf1) : null;
    const wSf2 = sf2 ? winnerOf(sf2) : null;
    if (wSf1 || wSf2) {
      upserts.push({
        match_id: cfId,
        tournament_type: "nba",
        round: "Conference Finals",
        conference: conf,
        seed1: wSf1?.seed ?? null,
        seed2: wSf2?.seed ?? null,
        team1: wSf1?.team ?? null,
        team2: wSf2?.team ?? null,
        team1_user_id: wSf1?.user_id ?? null,
        team2_user_id: wSf2?.user_id ?? null,
        status: "scheduled",
      });
    }
  }

  // Finals: populate as soon as EITHER conference champion is known
  const eastCf = map.get(CF_ID("East"));
  const westCf = map.get(CF_ID("West"));
  const wEast = eastCf ? winnerOf(eastCf) : null;
  const wWest = westCf ? winnerOf(westCf) : null;
  if (wEast || wWest) {
    upserts.push({
      match_id: FINAL_ID,
      tournament_type: "nba",
      round: "Finals",
      conference: null,
      seed1: wEast?.seed ?? null,
      seed2: wWest?.seed ?? null,
      team1: wEast?.team ?? null,
      team2: wWest?.team ?? null,
      team1_user_id: wEast?.user_id ?? null,
      team2_user_id: wWest?.user_id ?? null,
      status: "scheduled",
    });
  }

  return upserts;
}

/** All downstream match_ids affected when `matchId` changes (transitive). */
export function downstreamOf(matchId: string): string[] {
  const id = matchId.toLowerCase();
  const conf: "East" | "West" | null = id.includes("east")
    ? "East"
    : id.includes("west")
      ? "West"
      : null;

  if (id.startsWith("nba-r1-") && conf) {
    const c = conf.toLowerCase();
    if (id.endsWith("1v8") || id.endsWith("4v5"))
      return [`nba-r2-${c}-sf1`, `nba-r3-${c}-cf`, FINAL_ID];
    return [`nba-r2-${c}-sf2`, `nba-r3-${c}-cf`, FINAL_ID];
  }
  if (id.startsWith("nba-r2-") && conf) {
    const c = conf.toLowerCase();
    return [`nba-r3-${c}-cf`, FINAL_ID];
  }
  if (id.startsWith("nba-r3-") && conf) {
    return [FINAL_ID];
  }
  return [];
}

/**
 * Advance the bracket after a winner is set.
 * - Deletes downstream COMPLETED matches that are now stale (they depended on the old winner).
 * - Upserts/refreshes downstream SCHEDULED slots via computeNextRoundUpserts.
 * Returns { createdNext, deletedStale }.
 */
export async function advanceBracket(
  db: SupabaseClient,
  changedMatchId: string
): Promise<{ createdNext: string[]; deletedStale: string[] }> {
  const { data: all } = await db
    .from("tournament_matches")
    .select("*")
    .eq("tournament_type", "nba");

  const matches = ((all as NbaMatchRow[]) || []).filter(Boolean);
  const map = byId(matches);
  const downstream = downstreamOf(changedMatchId);

  // Find stale completed downstream: any downstream that is completed whose
  // participants no longer match the freshly computed participants.
  const wanted = computeNextRoundUpserts(matches);
  const wantedById = new Map(wanted.map((w) => [(w as { match_id: string }).match_id, w]));

  const deletedStale: string[] = [];
  for (const dId of downstream) {
    const existing = map.get(dId);
    const want = wantedById.get(dId) as
      | { team1?: string; team2?: string }
      | undefined;
    if (existing?.status === "completed") {
      // Completed downstream is stale if its teams differ from recomputed, or if recompute vanished
      if (
        !want ||
        (want.team1 !== undefined && want.team1 !== existing.team1) ||
        (want.team2 !== undefined && want.team2 !== existing.team2)
      ) {
        await db.from("tournament_matches").delete().eq("match_id", dId);
        deletedStale.push(dId);
        map.delete(dId);
      }
    }
  }

  // Also cascade: deleting a downstream completed match invalidates ITS downstream.
  // Re-fetch after deletes to recompute cleanly.
  let fresh = matches.filter((m) => !deletedStale.includes(m.match_id));
  if (deletedStale.length > 0) {
    const { data: refetched } = await db
      .from("tournament_matches")
      .select("*")
      .eq("tournament_type", "nba");
    const list = ((refetched as NbaMatchRow[]) || []).filter(Boolean);
    fresh = list;
    // Any completed match downstream of a deleted match is also stale → delete recursively
    for (const delId of [...deletedStale]) {
      for (const d2 of downstreamOf(delId)) {
        const m = list.find((x) => x.match_id === d2);
        if (m?.status === "completed" && !deletedStale.includes(d2)) {
          await db.from("tournament_matches").delete().eq("match_id", d2);
          deletedStale.push(d2);
          fresh = fresh.filter((x) => x.match_id !== d2);
        }
      }
    }
  }

  // Recompute wanted from fresh state and upsert only scheduled (never clobber completed winners)
  const finalWanted = computeNextRoundUpserts(fresh);
  const createdNext: string[] = [];
  for (const w of finalWanted) {
    const wid = (w as { match_id: string }).match_id;
    const existing = fresh.find((x) => x.match_id === wid);
    if (existing?.status === "completed") {
      // If computed teams match, leave winner alone. If mismatch it would have been deleted above.
      continue;
    }
    if (existing) {
      // Skip rows whose participants are already correct — otherwise every
      // unrelated advance would wipe this row's homecourt toss + scheduled games.
      const wr = w as Record<string, unknown>;
      const same =
        existing.team1 === (wr.team1 as string | null) &&
        existing.team2 === (wr.team2 as string | null) &&
        (existing.team1_user_id ?? null) === (wr.team1_user_id as string | null) &&
        (existing.team2_user_id ?? null) === (wr.team2_user_id as string | null) &&
        (existing.seed1 ?? null) === (wr.seed1 as number | null) &&
        (existing.seed2 ?? null) === (wr.seed2 as number | null);
      if (same) continue;
      // Admin-forced East SFs: never overwrite with natural feeders.
      if (isForcedEastSf1(wid, existing.team1, existing.team2)) continue;
      if (isForcedEastSf2(wid, existing.team1, existing.team2)) {
        // Forced Knicks-anchored sf2: only fill its TBD slot from the 3v6
        // winner (wanted team1). Never pull in the 2v7 winner (Pacers side
        // already plays in sf1) and never replace the Knicks anchor.
        const anchorIs1 = existing.team1 === FORCED_EAST_SF2_ANCHOR;
        const anchorIs2 = existing.team2 === FORCED_EAST_SF2_ANCHOR;
        const tbdIs1 = !existing.team1;
        const tbdIs2 = !existing.team2;
        const w3v6team = wr.team1 as string | null;
        if ((tbdIs1 || tbdIs2) && w3v6team && w3v6team !== FORCED_EAST_SF2_ANCHOR) {
          const fillSlotIs1 = tbdIs1;
          const alreadyThere =
            (!fillSlotIs1 && existing.team2 === w3v6team) || (fillSlotIs1 && existing.team1 === w3v6team);
          if (!alreadyThere) {
            const patch: Record<string, unknown> = { status: "scheduled", winner: null, winner_user_id: null, loser: null, player_a_team: null };
            if (fillSlotIs1) {
              patch.team1 = w3v6team;
              patch.team1_user_id = wr.team1_user_id as string | null;
              patch.seed1 = wr.seed1 as number | null;
            } else {
              patch.team2 = w3v6team;
              patch.team2_user_id = wr.team1_user_id as string | null;
              patch.seed2 = wr.seed1 as number | null;
            }
            const { error } = await db.from("tournament_matches").update(patch).eq("match_id", wid);
            if (!error) {
              createdNext.push(wid);
              try {
                await db.from("tournament_games").delete().eq("match_id", wid);
              } catch {}
            }
          }
        } else if (!tbdIs1 && !tbdIs2) {
          // Full forced row (Knicks vs filled): sync user_ids/seeds if the
          // filled side matches the 3v6 winner, else preserve as-is.
          const filledSide = anchorIs1 ? existing.team2 : anchorIs2 ? existing.team1 : null;
          if (filledSide && filledSide === w3v6team) {
            const patch: Record<string, unknown> = {};
            if (anchorIs1) {
              patch.team2_user_id = wr.team1_user_id as string | null;
              patch.seed2 = wr.seed1 as number | null;
            } else if (anchorIs2) {
              patch.team1_user_id = wr.team1_user_id as string | null;
              patch.seed1 = wr.seed1 as number | null;
            }
            if (Object.keys(patch).length > 0) {
              await db.from("tournament_matches").update(patch).eq("match_id", wid);
            }
          }
        }
        continue;
      }
      // Refresh participants on scheduled downstream (team change via override,
      // or a second feeder filling the TBD slot of a partial row)
      const { error } = await db
        .from("tournament_matches")
        .update({
          team1: (w as Record<string, unknown>).team1,
          team2: (w as Record<string, unknown>).team2,
          team1_user_id: (w as Record<string, unknown>).team1_user_id,
          team2_user_id: (w as Record<string, unknown>).team2_user_id,
          seed1: (w as Record<string, unknown>).seed1,
          seed2: (w as Record<string, unknown>).seed2,
          round: (w as Record<string, unknown>).round,
          conference: (w as Record<string, unknown>).conference,
          status: "scheduled",
          winner: null,
          winner_user_id: null,
          loser: null,
          player_a_team: null,
        })
        .eq("match_id", wid);
      if (!error) {
        createdNext.push(wid);
        // Participants changed → any already-played games + toss are stale
        try {
          await db.from("tournament_games").delete().eq("match_id", wid);
        } catch {}
      }
    } else {
      const { error } = await db.from("tournament_matches").insert(w);
      if (!error) createdNext.push(wid);
    }
  }

  return { createdNext, deletedStale };
}

/**
 * Reset a match to scheduled and remove/clean downstream that depended on its old winner.
 * NOTE: does not touch this match's own games — callers doing a full series
 * reset delete those explicitly; game-level overrides must keep them.
 * (Deleted downstream pairings cascade to their games via FK.)
 */
export async function resetMatchAndDownstream(
  db: SupabaseClient,
  matchId: string
): Promise<{ deletedStale: string[]; updatedDownstream: string[] }> {
  const downstream = downstreamOf(matchId);

  const { data: all } = await db
    .from("tournament_matches")
    .select("match_id,status,team1,team2")
    .eq("tournament_type", "nba");
  const list = ((all as { match_id: string; status: string }[]) || []).filter(Boolean);

  const deletedStale: string[] = [];
  const updatedDownstream: string[] = [];

  // Delete completed downstream first (they are invalid once source is reset)
  for (const dId of downstream) {
    const m = list.find((x) => x.match_id === dId);
    if (m?.status === "completed") {
      await db.from("tournament_matches").delete().eq("match_id", dId);
      deletedStale.push(dId);
    }
  }
  // For scheduled downstream, recompute after the reset and sync participants
  // immediately (no advance fires after a reset). Rows with no remaining
  // known participant are deleted to avoid ghost matchups; rows that keep
  // one side (partial) are updated back to TBD on the cleared slot, with
  // any toss/games for the stale pairing wiped.
  const { data: after } = await db
    .from("tournament_matches")
    .select("*")
    .eq("tournament_type", "nba");
  const fresh = ((after as NbaMatchRow[]) || []).filter(Boolean);
  const wanted = computeNextRoundUpserts(fresh);
  const wantedById = new Map(wanted.map((w) => [(w as { match_id: string }).match_id, w]));
  for (const dId of downstream) {
    const exists = fresh.find((x) => x.match_id === dId);
    if (!exists || exists.status === "completed") continue;
    // Admin-forced East SFs survive resets (e.g. resetting a First Round
    // series must not delete the Knicks-anchored sf2 or revert Pacers-76ers).
    if (isForcedEastSf1(dId, exists.team1, exists.team2)) continue;
    if (isForcedEastSf2(dId, exists.team1, exists.team2)) {
      const want = wantedById.get(dId) as Record<string, unknown> | undefined;
      const w3v6 = want?.team1 as string | null | undefined;
      const tbdIs1 = !exists.team1;
      const tbdIs2 = !exists.team2;
      if ((tbdIs1 || tbdIs2) && w3v6 && w3v6 !== FORCED_EAST_SF2_ANCHOR) {
        const patch: Record<string, unknown> = {
          status: "scheduled",
          winner: null,
          winner_user_id: null,
          loser: null,
          player_a_team: null,
        };
        if (tbdIs2) {
          patch.team2 = w3v6;
          patch.team2_user_id = want?.team1_user_id as string | null;
          patch.seed2 = want?.seed1 as number | null;
        } else {
          patch.team1 = w3v6;
          patch.team1_user_id = want?.team1_user_id as string | null;
          patch.seed1 = want?.seed1 as number | null;
        }
        await db.from("tournament_matches").update(patch).eq("match_id", dId);
        try {
          await db.from("tournament_games").delete().eq("match_id", dId);
        } catch {}
        updatedDownstream.push(dId);
      }
      continue;
    }
    const want = wantedById.get(dId) as Record<string, unknown> | undefined;
    if (!want) {
      await db.from("tournament_matches").delete().eq("match_id", dId);
      updatedDownstream.push(dId);
      continue;
    }
    const same =
      exists.team1 === (want.team1 as string | null) &&
      exists.team2 === (want.team2 as string | null) &&
      (exists.team1_user_id ?? null) === (want.team1_user_id as string | null) &&
      (exists.team2_user_id ?? null) === (want.team2_user_id as string | null) &&
      (exists.seed1 ?? null) === (want.seed1 as number | null) &&
      (exists.seed2 ?? null) === (want.seed2 as number | null);
    if (same) continue;
    await db
      .from("tournament_matches")
      .update({
        team1: want.team1,
        team2: want.team2,
        team1_user_id: want.team1_user_id,
        team2_user_id: want.team2_user_id,
        seed1: want.seed1,
        seed2: want.seed2,
        status: "scheduled",
        winner: null,
        winner_user_id: null,
        loser: null,
        player_a_team: null,
      })
      .eq("match_id", dId);
    try {
      await db.from("tournament_games").delete().eq("match_id", dId);
    } catch {}
    updatedDownstream.push(dId);
  }

  return { deletedStale, updatedDownstream };
}
