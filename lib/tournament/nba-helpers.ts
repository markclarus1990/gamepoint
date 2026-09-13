import { TEAM_CONFERENCES } from "@/lib/constants/nba";
import type { Conference } from "@/lib/constants/nba";

export type NbaRegistrationRow = {
  user_id: string;
  team: string;
  created_at: string;
  conference?: string | null;
  division?: string | null;
};

export type GroupedByConference = {
  east: NbaRegistrationRow[];
  west: NbaRegistrationRow[];
  unknown: NbaRegistrationRow[];
};

export function getConferenceForTeam(team: string): Conference | null {
  const info = TEAM_CONFERENCES[team];
  if (info) return info.conference;
  return null;
}

/**
 * Resolve the conference for a registration row.
 * Priority: TEAM_CONFERENCES lookup -> row.conference column -> null
 */
export function resolveConference(row: NbaRegistrationRow): Conference | null {
  if (!row?.team) return (row.conference as Conference) || null;
  const byTeam = getConferenceForTeam(row.team);
  if (byTeam) return byTeam;
  if (row.conference === "East" || row.conference === "West") return row.conference;
  return null;
}

/**
 * Group registrations by their *real* NBA conference (via TEAM_CONFERENCES).
 * Within each group, sort by created_at ASC so earliest = seed 1.
 * Unknown teams (should not happen) go to `unknown` so caller can decide.
 */
export function groupByConference(regs: NbaRegistrationRow[]): GroupedByConference {
  const east: NbaRegistrationRow[] = [];
  const west: NbaRegistrationRow[] = [];
  const unknown: NbaRegistrationRow[] = [];

  const sorted = [...regs].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
    return ta - tb;
  });

  for (const r of sorted) {
    const conf = resolveConference(r);
    if (conf === "East") east.push(r);
    else if (conf === "West") west.push(r);
    else unknown.push(r);
  }

  // For robustness: if caller expects strict 8/8 but some teams are unknown,
  // we leave them in unknown rather than silently balancing — caller decides.
  return { east, west, unknown };
}

/**
 * Build conference-aware slot indices for UI.
 * East occupies global slots 1-8, West occupies 9-16.
 * Within each conference seeds are 1..N in created_at order.
 */
export function buildConferencePlayers<T extends NbaRegistrationRow>(
  regs: T[],
  playerMap: Map<string, unknown>
) {
  const { east, west, unknown } = groupByConference(regs);

  // If unknowns exist, distribute to smaller conference to avoid losing them visually
  // (but prefer to surface them; caller may want to treat differently)
  if (unknown.length > 0) {
    // Push unknowns to smaller side to keep balanced display; they will still show but with fallback badge
    for (const u of unknown) {
      if (east.length <= west.length) east.push(u);
      else west.push(u);
    }
    // re-sort after adding unknowns
    const sortByCreated = (a: NbaRegistrationRow, b: NbaRegistrationRow) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    east.sort(sortByCreated);
    west.sort(sortByCreated);
  }

  const conferencePlayers: Array<
    T & { conference: Conference; slotIndex: number; seed: number }
  > = [];

  east.forEach((r, i) => {
    const base = (playerMap.get(r.user_id) as object) || { id: r.user_id, name: "Unknown", avatar_url: null, points: 0 };
    conferencePlayers.push({
      ...(base as object),
      team: r.team,
      conference: "East" as const,
      slotIndex: i + 1, // 1..8
      seed: i + 1,
      created_at: r.created_at,
    } as never);
  });

  west.forEach((r, i) => {
    const base = (playerMap.get(r.user_id) as object) || { id: r.user_id, name: "Unknown", avatar_url: null, points: 0 };
    conferencePlayers.push({
      ...(base as object),
      team: r.team,
      conference: "West" as const,
      slotIndex: 8 + i + 1, // 9..16
      seed: i + 1,
      created_at: r.created_at,
    } as never);
  });

  return {
    east,
    west,
    unknown,
    eastCount: east.length,
    westCount: west.length,
    conferencePlayers,
  };
}
