"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Loader2, RefreshCw, RotateCcw, Check, User } from "lucide-react";
import { getTeamLogo } from "@/lib/constants/nba";
import type { TournamentMatch, TournamentGame } from "@/types";

const ROUND_ORDER = ["First Round", "Semifinals", "Conference Finals", "Finals"];

function roundSort(a: TournamentMatch, b: TournamentMatch) {
  const ra = ROUND_ORDER.indexOf(a.round);
  const rb = ROUND_ORDER.indexOf(b.round);
  if (ra !== rb) return ra - rb;
  const ca = a.conference || "";
  const cb = b.conference || "";
  if (ca !== cb) return ca.localeCompare(cb);
  return a.match_id.localeCompare(b.match_id);
}

function getAdminId(): string | null {
  try {
    const stored = localStorage.getItem("user");
    if (stored) return (JSON.parse(stored) as { id?: string }).id ?? null;
  } catch {}
  return null;
}

export default function AdminTournament({ notify }: { notify: (msg: string) => void }) {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [games, setGames] = useState<TournamentGame[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [champion, setChampion] = useState<string | null>(null);
  const [championName, setChampionName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [gamePick, setGamePick] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  // notify is an inline (unstable) fn in the parent dashboard which re-renders
  // every 5s from its polling interval — keep it in a ref so our fetch effect
  // runs once on mount instead of on every parent render (the refresh loop).
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/admin/tournament/set-winner?round=all");
      const data = await res.json();
      if (data.error) {
        notifyRef.current(data.error);
      } else {
        setMatches((data.matches || []) as TournamentMatch[]);
        setGames((data.games || []) as TournamentGame[]);
        setPlayerNames((data.users || {}) as Record<string, string>);
        setChampion(data.champion ?? null);
        setChampionName(data.championName ?? null);
      }
    } catch {
      notifyRef.current("Failed to load tournament matches");
    } finally {
      if (initial) setLoading(false);
      else setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const grouped = useMemo(() => {
    const sorted = [...matches].sort(roundSort);
    const map = new Map<string, TournamentMatch[]>();
    for (const r of ROUND_ORDER) map.set(r, []);
    for (const m of sorted) {
      const arr = map.get(m.round) || [];
      arr.push(m);
      map.set(m.round, arr);
    }
    return map;
  }, [matches]);

  const gamesByMatch = useMemo(() => {
    const map = new Map<string, TournamentGame[]>();
    for (const g of games) {
      const arr = map.get(g.match_id) || [];
      arr.push(g);
      map.set(g.match_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.game_number - b.game_number);
    return map;
  }, [games]);

  const tallyFor = useCallback(
    (m: TournamentMatch): { wins1: number; wins2: number; played: number } => {
      const list = gamesByMatch.get(m.match_id) || [];
      let wins1 = 0;
      let wins2 = 0;
      let played = 0;
      for (const g of list) {
        if (g.status === "completed" && g.winner) {
          played++;
          if (g.winner === m.team1) wins1++;
          else if (g.winner === m.team2) wins2++;
        }
      }
      return { wins1, wins2, played };
    },
    [gamesByMatch]
  );

  const ownerName = useCallback(
    (userId: string | null) => (userId && playerNames[userId] ? playerNames[userId] : "—"),
    [playerNames]
  );

  async function adminPost(body: Record<string, unknown>): Promise<{ error?: string } & Record<string, unknown>> {
    const res = await fetch("/api/admin/tournament/set-winner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, admin_id: getAdminId() }),
    });
    return res.json();
  }

  const coinToss = async (matchId: string, playerA?: string) => {
    setSavingId(`${matchId}:toss`);
    try {
      const data = await adminPost({ match_id: matchId, action: "coin_toss", ...(playerA ? { player_a: playerA } : {}) });
      if (data.error) {
        notifyRef.current(data.error as string);
      } else {
        notifyRef.current(`🪙 Homecourt: ${data.playerA} hosts G1/G3/G5`);
        await load(false);
      }
    } catch {
      notifyRef.current("Homecourt set failed");
    } finally {
      setSavingId(null);
    }
  };

  const setSeriesWinner = async (match: TournamentMatch) => {
    const winner = pick[match.match_id] || match.team1 || "";
    if (!winner) {
      notifyRef.current("Pick a winner first");
      return;
    }
    setSavingId(match.match_id);
    try {
      const data = await adminPost({ match_id: match.match_id, winner });
      if (data.error) {
        notifyRef.current(data.error as string);
      } else {
        const extra =
          (data.createdNext as string[])?.length > 0 ? ` → advanced: ${(data.createdNext as string[]).join(", ")}` : "";
        const stale =
          (data.deletedStale as string[])?.length > 0 ? ` (cleared stale: ${(data.deletedStale as string[]).join(", ")})` : "";
        const champ = data.champion ? ` 🏆 CHAMPION: ${data.champion}` : "";
        notifyRef.current(`Winner set: ${winner}${extra}${stale}${champ}`);
        await load(false);
      }
    } catch {
      notifyRef.current("Failed to set winner");
    } finally {
      setSavingId(null);
    }
  };

  const setGameWinner = async (match: TournamentMatch, n: number) => {
    const key = `${match.match_id}:${n}`;
    const winner = gamePick[key];
    if (!winner) {
      notifyRef.current(`Pick a winner for G${n} first`);
      return;
    }
    setSavingId(key);
    try {
      const data = await adminPost({ match_id: match.match_id, game_number: n, winner });
      if (data.error) {
        notifyRef.current(data.error as string);
      } else {
        const t = data.tally as { wins1: number; wins2: number } | undefined;
        const score = t ? ` (${match.team1} ${t.wins1} – ${t.wins2} ${match.team2})` : "";
        const extra =
          (data.createdNext as string[])?.length > 0
            ? ` → series decided, advanced: ${(data.createdNext as string[]).join(", ")}`
            : "";
        const champ = data.champion ? ` 🏆 CHAMPION: ${data.champion}` : "";
        notifyRef.current(`G${n} winner: ${winner}${score}${extra}${champ}`);
        await load(false);
      }
    } catch {
      notifyRef.current("Failed to set game winner");
    } finally {
      setSavingId(null);
    }
  };

  const resetGame = async (matchId: string, n: number) => {
    const key = `${matchId}:${n}:reset`;
    setSavingId(key);
    try {
      const data = await adminPost({ match_id: matchId, game_number: n, action: "reset" });
      if (data.error) {
        notifyRef.current(data.error as string);
      } else {
        notifyRef.current(`G${n} reset (G${n}+ cleared).`);
        await load(false);
      }
    } catch {
      notifyRef.current("Failed to reset game");
    } finally {
      setSavingId(null);
    }
  };

  const resetWinner = async (matchId: string) => {
    setSavingId(matchId);
    try {
      const data = await adminPost({ match_id: matchId, action: "reset" });
      if (data.error) {
        notifyRef.current(data.error as string);
      } else {
        const stale =
          (data.deletedStale as string[])?.length > 0 ? ` Cleared downstream: ${(data.deletedStale as string[]).join(", ")}` : "";
        notifyRef.current(`Series reset to scheduled (games cleared).${stale}`);
        setConfirmReset(null);
        await load(false);
      }
    } catch {
      notifyRef.current("Failed to reset match");
    } finally {
      setSavingId(null);
    }
  };

  const resetAll = async () => {
    setSavingId("__all__");
    try {
      const data = await adminPost({ action: "reset_all" });
      if (data.error) {
        notifyRef.current(data.error as string);
      } else {
        notifyRef.current(
          `Results reset — ${data.resetFirstRound ?? 0} First Round back to scheduled, ${data.clearedDownstream ?? 0} later-round games cleared. Same players, same matchups.`
        );
        setPick({});
        setGamePick({});
        setConfirmReset(null);
        setConfirmResetAll(false);
        await load(false);
      }
    } catch {
      notifyRef.current("Failed to reset tournament");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-8 text-center text-sm text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-pink-500" /> Loading tournament…
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-8 text-center">
        <div className="text-3xl mb-2">🏀</div>
        <div className="font-bold">No matches yet</div>
        <p className="text-sm text-zinc-500 mt-1">
          First Round auto-generates when 16 teams lock (8 East + 8 West).
        </p>
        <button
          onClick={() => load(false)}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-400" /> NBA Tournament Control
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {matches.filter((m) => m.status === "completed").length}/{matches.length} series complete
            {champion ? (
              <span className="text-yellow-400 font-bold"> • 🏆 Champion: {champion}{championName ? ` (${championName})` : ""}</span>
            ) : (
              " • Best-of-5: toss coin, set winner per game — first to 3 advances"
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {confirmResetAll ? (
            <span className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-amber-400 font-semibold">
                Clear all winners + later rounds? Players &amp; First Round stay.
              </span>
              <button
                onClick={resetAll}
                disabled={savingId === "__all__"}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-400 disabled:opacity-40"
              >
                {savingId === "__all__" ? "Resetting…" : "Yes, reset all"}
              </button>
              <button
                onClick={() => setConfirmResetAll(false)}
                className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-300"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmResetAll(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" /> Reset all results
            </button>
          )}
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-zinc-800/70 hover:bg-zinc-700/70 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {ROUND_ORDER.map((round) => {
        const list = grouped.get(round) || [];
        if (list.length === 0) {
          return (
            <div key={round} className="bg-[#0f1b2e]/60 border border-dashed border-white/10 rounded-2xl p-4">
              <h3 className="font-bold text-sm text-zinc-300">{round}</h3>
              <p className="text-xs text-zinc-600 mt-1">
                Awaiting series winners from previous round — completes automatically.
              </p>
            </div>
          );
        }
        return (
          <div key={round} className="bg-[#0f1b2e] border border-white/5 rounded-2xl p-4">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              {round === "Finals" && <Trophy className="w-4 h-4 text-yellow-400" />}
              {round}
              <span className="text-xs font-normal text-zinc-500">
                {list.filter((m) => m.status === "completed").length}/{list.length} decided
              </span>
            </h3>
            <div className="space-y-3">
              {list.map((m) => (
                <SeriesCard
                  key={m.match_id}
                  m={m}
                  seriesGames={gamesByMatch.get(m.match_id) || []}
                  tally={tallyFor(m)}
                  ownerName={ownerName}
                  pick={pick[m.match_id] ?? m.winner ?? m.team1 ?? ""}
                  onPick={(team) => setPick((p) => ({ ...p, [m.match_id]: team }))}
                  gamePick={gamePick}
                  onGamePick={(n, team) => setGamePick((p) => ({ ...p, [`${m.match_id}:${n}`]: team }))}
                  savingId={savingId}
                  confirmReset={confirmReset === m.match_id}
                  onCoinToss={(playerA) => coinToss(m.match_id, playerA)}
                  onSetSeries={() => setSeriesWinner(m)}
                  onSetGame={(n) => setGameWinner(m, n)}
                  onResetGame={(n) => resetGame(m.match_id, n)}
                  onAskReset={() => setConfirmReset(m.match_id)}
                  onCancelReset={() => setConfirmReset(null)}
                  onReset={() => resetWinner(m.match_id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeriesCard(props: {
  m: TournamentMatch;
  seriesGames: TournamentGame[];
  tally: { wins1: number; wins2: number; played: number };
  ownerName: (userId: string | null) => string;
  pick: string;
  onPick: (team: string) => void;
  gamePick: Record<string, string>;
  onGamePick: (n: number, team: string) => void;
  savingId: string | null;
  confirmReset: boolean;
  onCoinToss: (playerA: string) => void;
  onSetSeries: () => void;
  onSetGame: (n: number) => void;
  onResetGame: (n: number) => void;
  onAskReset: () => void;
  onCancelReset: () => void;
  onReset: () => void;
}) {
  const { m, seriesGames, tally, ownerName } = props;
  const isCompleted = m.status === "completed";
  const saving = props.savingId === m.match_id;
  const hasToss = Boolean(m.player_a_team);
  const playerA = m.player_a_team ?? null;
  const playerB = playerA ? (playerA === m.team1 ? m.team2 : m.team1) : null;
  const decided = isCompleted && m.winner;
  const legacyDecided = decided && seriesGames.length === 0;

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 ${
        isCompleted
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : "border-white/10 bg-zinc-900/50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="text-[11px] text-zinc-500 font-mono">
          {m.match_id} {m.conference ? `• ${m.conference}` : "• East vs West"}
          {m.seed1 != null && m.seed2 != null && (
            <span> • Seed {m.seed1} vs {m.seed2}</span>
          )}
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-1 rounded-full border ${
            isCompleted
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
              : "bg-zinc-800 text-zinc-400 border-white/10"
          }`}
        >
          {decided
            ? `✓ ${m.winner} takes series ${m.winner === m.team1 ? tally.wins1 : tally.wins2}–${m.winner === m.team1 ? tally.wins2 : tally.wins1}`
            : seriesGames.length > 0
              ? `Series ${tally.wins1}–${tally.wins2} (first to 3)`
              : "Best-of-5"}
        </span>
      </div>

      {/* Series score line */}
      <div className="flex items-center gap-3 mb-3">
        <TeamScore team={m.team1} userId={m.team1_user_id} wins={tally.wins1} ownerName={ownerName} highlight={m.winner === m.team1} />
        <span className="text-zinc-600 font-black text-lg">–</span>
        <TeamScore team={m.team2} userId={m.team2_user_id} wins={tally.wins2} ownerName={ownerName} highlight={m.winner === m.team2} />
      </div>

      {/* Homecourt pick */}
      {!hasToss && !decided && (
        <div className="mb-3 rounded-lg border border-dashed border-white/15 bg-zinc-950/60 p-3">
          <div className="text-xs text-zinc-400 mb-2">
            🪙 Homecourt not set — pick who hosts <span className="font-semibold text-zinc-200">G1/G3/G5</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {([m.team1, m.team2] as (string | null)[]).map((team) => {
              if (!team) return null;
              return (
                <button
                  key={team}
                  onClick={() => props.onCoinToss(team)}
                  disabled={props.savingId === `${m.match_id}:toss`}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40"
                >
                  {props.savingId === `${m.match_id}:toss` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <img
                      src={getTeamLogo(team)}
                      alt={team}
                      loading="lazy"
                      className="w-5 h-5 object-contain bg-white rounded-full p-0.5 shrink-0"
                      onError={(e) => ((e.currentTarget.style.display = "none"))}
                    />
                  )}
                  {team} hosts
                </button>
              );
            })}
          </div>
        </div>
      )}
      {hasToss && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-[11px] text-amber-400/90 font-semibold">
            🪙 {playerA} (A) hosts G1/G3/G5 · {playerB} (B) hosts G2/G4
          </div>
          {tally.played === 0 && !decided && (
            <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">
              Change:
              {([m.team1, m.team2] as (string | null)[]).map((team) => {
                if (!team || team === playerA) return null;
                return (
                  <button
                    key={team}
                    onClick={() => props.onCoinToss(team)}
                    disabled={props.savingId === `${m.match_id}:toss`}
                    className="px-2 py-1 rounded-lg text-[11px] font-semibold border border-amber-500/30 text-amber-300 hover:bg-amber-500/10 disabled:opacity-40"
                  >
                    {props.savingId === `${m.match_id}:toss` ? "…" : `${team} hosts instead`}
                  </button>
                );
              })}
            </span>
          )}
        </div>
      )}
      {legacyDecided && (
        <div className="mb-3 text-[11px] text-zinc-500">
          Decided before best-of-5 (single result kept). Reset the series to replay as best-of-5.
        </div>
      )}

      {/* Per-game controls */}
      {hasToss && seriesGames.length > 0 && (
        <div className="space-y-2 mb-3">
          {seriesGames.map((g) => {
            const key = `${m.match_id}:${g.game_number}`;
            const selected = props.gamePick[key] ?? g.winner ?? "";
            const done = g.status === "completed";
            const busy = props.savingId === key || props.savingId === `${key}:reset`;
            const locked =
              !done &&
              g.game_number === 5 &&
              !(tally.wins1 === 2 && tally.wins2 === 2);
            return (
              <div
                key={g.game_number}
                className={`rounded-lg border p-2.5 ${done ? "border-white/10 bg-zinc-950/60" : locked ? "border-dashed border-white/10 bg-transparent opacity-70" : "border-white/10 bg-zinc-950/40"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="text-[11px] font-bold text-zinc-300">
                    G{g.game_number}
                    <span className="font-normal text-zinc-500"> · vs @{g.home_team ?? "TBD"}</span>
                  </div>
                  {done ? (
                    <span className="text-[11px] font-semibold text-emerald-400">🏆 {g.winner}</span>
                  ) : locked ? (
                    <span className="text-[11px] text-zinc-600">Locked — only if 2-2</span>
                  ) : (
                    <span className="text-[11px] text-zinc-600">Pick winner ↓</span>
                  )}
                </div>
                {!locked && (
                  <div className="flex flex-wrap items-center gap-2">
                    {([m.team1, m.team2] as (string | null)[]).map((team) => {
                      if (!team) return null;
                      const active = selected === team;
                      return (
                        <button
                          key={team}
                          onClick={() => props.onGamePick(g.game_number, team)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                            active
                              ? "border-orange-500/60 bg-orange-500/10 text-white"
                              : "border-white/10 bg-zinc-900/60 text-zinc-300 hover:border-white/20"
                          }`}
                        >
                          <img
                            src={getTeamLogo(team)}
                            alt={team}
                            loading="lazy"
                            className="w-5 h-5 object-contain bg-white rounded-full p-0.5 shrink-0"
                            onError={(e) => ((e.currentTarget.style.display = "none"))}
                          />
                          <span className="truncate max-w-[140px]">{team}</span>
                          {g.winner === team && <span className="text-emerald-400">✓</span>}
                          {active && g.winner !== team && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => props.onSetGame(g.game_number)}
                      disabled={busy || !selected}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40"
                    >
                      {props.savingId === key ? "Saving…" : done ? "Override" : `Set G${g.game_number}`}
                    </button>
                    {done && (
                      <button
                        onClick={() => props.onResetGame(g.game_number)}
                        disabled={busy}
                        title={`Reset G${g.game_number} (+ later games)`}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-40"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Direct series decide (pre-toss fallback) + series reset */}
      <div className="flex flex-wrap gap-2">
        {!hasToss && !decided && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {([m.team1, m.team2] as (string | null)[]).map((team) => {
                if (!team) return null;
                const active = props.pick === team;
                return (
                  <button
                    key={team}
                    onClick={() => props.onPick(team)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${active ? "border-orange-500/60 bg-orange-500/10 text-white" : "border-white/10 text-zinc-400"}`}
                  >
                    {team}
                  </button>
                );
              })}
            </div>
            <button
              onClick={props.onSetSeries}
              disabled={saving || !props.pick}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Decide series directly
            </button>
          </>
        )}
        {!props.confirmReset && (
          <button
            onClick={props.onAskReset}
            disabled={saving}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-zinc-800/70 text-zinc-400 hover:text-white disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" /> Reset series
          </button>
        )}
        {props.confirmReset && (
          <span className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-amber-400 font-semibold">
              Reset clears games + winner + downstream. Sure?
            </span>
            <button
              onClick={props.onReset}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-400 disabled:opacity-40"
            >
              {saving ? "Resetting…" : "Yes, reset"}
            </button>
            <button
              onClick={props.onCancelReset}
              className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-300"
            >
              Cancel
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

function TeamScore(props: {
  team: string | null;
  userId: string | null;
  wins: number;
  ownerName: (userId: string | null) => string;
  highlight: boolean;
}) {
  if (!props.team) return null;
  return (
    <div className={`flex items-center gap-2 min-w-0 ${props.highlight ? "text-emerald-300" : "text-white"}`}>
      <img
        src={getTeamLogo(props.team)}
        alt={props.team}
        loading="lazy"
        className="w-8 h-8 object-contain bg-white rounded-full p-1 shrink-0"
        onError={(e) => ((e.currentTarget.style.display = "none"))}
      />
      <div className="min-w-0">
        <div className="text-sm font-bold truncate">{props.team} {props.highlight && "🏆"}</div>
        <div className="flex items-center gap-1 text-[11px] font-normal text-zinc-500">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate">{props.ownerName(props.userId)}</span>
        </div>
      </div>
      <div className="text-2xl font-black tabular-nums">{props.wins}</div>
    </div>
  );
}
