"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trophy, Loader2, RefreshCw, RotateCcw, Check, User } from "lucide-react";
import { getTeamLogo } from "@/lib/constants/nba";
import type { TournamentMatch } from "@/types";

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

export default function AdminTournament({ notify }: { notify: (msg: string) => void }) {
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [champion, setChampion] = useState<string | null>(null);
  const [championName, setChampionName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
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

  const setWinner = async (match: TournamentMatch) => {
    const winner = pick[match.match_id] || match.team1 || "";
    if (!winner) {
      notify("Pick a winner first");
      return;
    }
    setSavingId(match.match_id);
    try {
      let adminId: string | null = null;
      try {
        const stored = localStorage.getItem("user");
        if (stored) adminId = (JSON.parse(stored) as { id?: string }).id ?? null;
      } catch {}
      const res = await fetch("/api/admin/tournament/set-winner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: match.match_id, winner, admin_id: adminId }),
      });
      const data = await res.json();
      if (data.error) {
        notify(data.error);
      } else {
        const extra =
          data.createdNext?.length > 0 ? ` → advanced: ${data.createdNext.join(", ")}` : "";
        const stale =
          data.deletedStale?.length > 0 ? ` (cleared stale: ${data.deletedStale.join(", ")})` : "";
        const champ = data.champion ? ` 🏆 CHAMPION: ${data.champion}` : "";
        notify(`Winner set: ${winner}${extra}${stale}${champ}`);
        await load();
      }
    } catch {
      notify("Failed to set winner");
    } finally {
      setSavingId(null);
    }
  };

  const resetWinner = async (matchId: string) => {
    setSavingId(matchId);
    try {
      let adminId: string | null = null;
      try {
        const stored = localStorage.getItem("user");
        if (stored) adminId = (JSON.parse(stored) as { id?: string }).id ?? null;
      } catch {}
      const res = await fetch("/api/admin/tournament/set-winner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match_id: matchId, action: "reset", admin_id: adminId }),
      });
      const data = await res.json();
      if (data.error) {
        notify(data.error);
      } else {
        const stale =
          data.deletedStale?.length > 0 ? ` Cleared downstream: ${data.deletedStale.join(", ")}` : "";
        notify(`Match reset to scheduled.${stale}`);
        setConfirmReset(null);
        await load();
      }
    } catch {
      notify("Failed to reset match");
    } finally {
      setSavingId(null);
    }
  };

  const resetAll = async () => {
    setSavingId("__all__");
    try {
      let adminId: string | null = null;
      try {
        const stored = localStorage.getItem("user");
        if (stored) adminId = (JSON.parse(stored) as { id?: string }).id ?? null;
      } catch {}
      const res = await fetch("/api/admin/tournament/set-winner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_all", admin_id: adminId }),
      });
      const data = await res.json();
      if (data.error) {
        notifyRef.current(data.error);
      } else {
        notifyRef.current(
          `Results reset — ${data.resetFirstRound ?? 0} First Round back to scheduled, ${data.clearedDownstream ?? 0} later-round games cleared. Same players, same matchups.`
        );
        setPick({});
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
            {matches.filter((m) => m.status === "completed").length}/{matches.length} complete
            {champion ? (
              <span className="text-yellow-400 font-bold"> • 🏆 Champion: {champion}{championName ? ` (${championName})` : ""}</span>
            ) : (
              " • Pick a winner per game — next round auto-creates"
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
                Awaiting winners from previous round — completes automatically.
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
                {list.filter((m) => m.status === "completed").length}/{list.length} done
              </span>
            </h3>
            <div className="space-y-3">
              {list.map((m) => {
                const selected = pick[m.match_id] ?? m.winner ?? m.team1 ?? "";
                const isCompleted = m.status === "completed";
                const saving = savingId === m.match_id;
                return (
                  <div
                    key={m.match_id}
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
                        {isCompleted ? `✓ ${m.winner} won${m.winner_user_id && playerNames[m.winner_user_id] ? ` (${playerNames[m.winner_user_id]})` : ""}` : "Scheduled"}
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2 mb-3">
                      {(
                        [
                          { team: m.team1, userId: m.team1_user_id },
                          { team: m.team2, userId: m.team2_user_id },
                        ] as { team: string | null; userId: string | null }[]
                      ).map(({ team, userId }) => {
                        if (!team) return null;
                        const active = selected === team;
                        const isWinner = m.winner === team;
                        const owner = userId ? playerNames[userId] : null;
                        return (
                          <button
                            key={team}
                            onClick={() => setPick((p) => ({ ...p, [m.match_id]: team }))}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left text-sm font-semibold transition-all ${
                              active
                                ? "border-orange-500/60 bg-orange-500/10 text-white"
                                : "border-white/10 bg-zinc-950/60 text-zinc-300 hover:border-white/20"
                            }`}
                          >
                            <img
                              src={getTeamLogo(team)}
                              alt={team}
                              loading="lazy"
                              className="w-8 h-8 object-contain bg-white rounded-full p-1 shrink-0"
                              onError={(e) => ((e.currentTarget.style.display = "none"))}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block truncate">{team}</span>
                              <span className="flex items-center gap-1 text-[11px] font-normal text-zinc-500">
                                <User className="w-3 h-3 shrink-0" />
                                <span className="truncate">{owner ?? "—"}</span>
                              </span>
                            </span>
                            {isWinner && <span className="text-emerald-400 text-xs shrink-0">🏆</span>}
                            {active && !isWinner && <Check className="w-4 h-4 text-orange-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setWinner(m)}
                        disabled={saving || !selected}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-40"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {isCompleted ? "Override winner" : "Set winner"}
                      </button>
                      {isCompleted && confirmReset !== m.match_id && (
                        <button
                          onClick={() => setConfirmReset(m.match_id)}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium bg-zinc-800/70 text-zinc-400 hover:text-white disabled:opacity-40"
                        >
                          <RotateCcw className="w-4 h-4" /> Reset
                        </button>
                      )}
                      {confirmReset === m.match_id && (
                        <span className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-amber-400 font-semibold">
                            Reset clears this + downstream games. Sure?
                          </span>
                          <button
                            onClick={() => resetWinner(m.match_id)}
                            disabled={saving}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-400 disabled:opacity-40"
                          >
                            {saving ? "Resetting…" : "Yes, reset"}
                          </button>
                          <button
                            onClick={() => setConfirmReset(null)}
                            className="px-3 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-300"
                          >
                            Cancel
                          </button>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
