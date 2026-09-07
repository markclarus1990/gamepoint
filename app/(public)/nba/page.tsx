"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Swords, Users, Target, X, LogIn, Trophy, Clock, Zap } from "lucide-react";
import Footer from "@/app/components/Footer";
import NbaTeamSelector from "@/components/nba-team-selector";
import { NBA_TEAMS, TEAM_CONFERENCES, getTeamLogo } from "@/lib/constants/nba";

const MAX_PLAYERS = 16;

interface PlayerInfo {
  id: string;
  name: string;
  avatar_url: string | null;
  points: number;
  team?: string | null;
  conference?: string;
  slotIndex?: number;
}

interface BracketData {
  east: { players: { id: string; team: string; seed: number }[]; firstRoundMatchups: { team1: string; team2: string; seed1: number; seed2?: number; seed8?: number; matchId: string }[] };
  west: { players: { id: string; team: string; seed: number }[]; firstRoundMatchups: { team1: string; team2: string; seed1: number; seed2?: number; seed8?: number; matchId: string }[] };
}

export default function NbaPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [rawCount, setRawCount] = useState(0);
  const [eastCount, setEastCount] = useState(0);
  const [westCount, setWestCount] = useState(0);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [matches, setMatches] = useState<unknown[]>([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [showUnregisterModal, setShowUnregisterModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [pendingTeam, setPendingTeam] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentUser({ id: parsed.id, name: parsed.name });
      }
    } catch {}
  }, []);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/tournament/register?action=players");
      const data = await res.json();
      const plist: PlayerInfo[] = data.players || [];
      setPlayers(plist);
      setRawCount(data.count ?? plist.length);
      setEastCount(data.eastCount ?? Math.min(8, Math.ceil(plist.length / 2)));
      setWestCount(data.westCount ?? plist.length - Math.min(8, Math.ceil(plist.length / 2)));
      setTournamentStarted(Boolean(data.tournamentStarted) || plist.length === MAX_PLAYERS);

      if (data.count === MAX_PLAYERS || data.tournamentStarted) {
        const [bRes, mRes] = await Promise.all([
          fetch("/api/tournament/bracket").then((r) => r.json()).catch(() => ({})),
          fetch("/api/tournament/matches").then((r) => r.json()).catch(() => ({})),
        ]);
        if (bRes.bracket) setBracket(bRes.bracket);
        else if (bRes.error) setBracket(null);
        setMatches(mRes.matches || []);
      } else {
        setBracket(null);
        setMatches([]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const playerMap = new Map(players.map((p) => [p.slotIndex, p]));
  const orderedPlayers: (PlayerInfo | null)[] = Array.from({ length: MAX_PLAYERS }, (_, i) => playerMap.get(i + 1) || null);

  const takenTeams = players.map((p) => p.team).filter(Boolean) as string[];
  const availableTeams = NBA_TEAMS.filter((t) => !takenTeams.includes(t));
  const registeredCount = rawCount;
  const progress = (registeredCount / MAX_PLAYERS) * 100;
  const isFull = registeredCount >= MAX_PLAYERS;
  const currentUserPlayer = players.find((p) => p.id === currentUser?.id);
  const currentUserRegistered = Boolean(currentUserPlayer);
  const spotsLeft = MAX_PLAYERS - registeredCount;

  function handleSlotClick(player: PlayerInfo | null) {
    if (submitting) return;
    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (tournamentStarted) {
      showToast("Tournament already started — bracket is locked (16 teams complete)", "error");
      return;
    }
    if (player) {
      if (player.id === currentUser.id) {
        setShowUnregisterModal(true);
      }
      return;
    }
    // empty slot
    if (currentUserRegistered) {
      showToast("You already registered (1 player = 1 team)", "error");
      return;
    }
    if (isFull) {
      showToast("Tournament is full", "error");
      return;
    }
    setShowSelector(true);
  }

  async function handleTeamSelected(team: string) {
    if (!currentUser) return;
    setPendingTeam(team);
    // auto-confirm via selector modal, we handle registration here
    setSubmitting(true);
    try {
      const res = await fetch("/api/tournament/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id, team }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Registration failed", "error");
      } else {
        showToast(`Locked ${team}! ${data.tournamentStarted ? "Tournament has STARTED — bracket generated!" : `${spotsLeft - 1} spots left`}`, "success");
        setShowSelector(false);
        setPendingTeam(null);
        await fetchData();
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmUnregister() {
    if (!currentUser) return;
    if (tournamentStarted) {
      showToast("Cannot unregister — tournament already started", "error");
      setShowUnregisterModal(false);
      return;
    }
    setSubmitting(true);
    setShowUnregisterModal(false);
    try {
      const res = await fetch("/api/tournament/register", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) showToast(data.error || "Failed to unregister", "error");
      else {
        showToast("Unregistered — your team is now available again", "success");
        await fetchData();
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-gray-400">Loading NBA Tournament...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 space-y-8">
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-white font-semibold text-sm ${toast.type === "success" ? "bg-green-600 border border-green-400" : "bg-red-600 border border-red-400"}`}>{toast.message}</div>
        )}

        {/* Unregister Modal */}
        {showUnregisterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Leave Tournament?</h3>
                <button onClick={() => setShowUnregisterModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-300 text-sm mb-1">You are registered as <span className="text-white font-bold">{currentUserPlayer?.team}</span>.</p>
              <p className="text-gray-400 text-xs mb-6">Your team will become available again for others (first-come rule). Cannot leave after tournament starts (16/16).</p>
              <div className="flex gap-3">
                <button onClick={() => setShowUnregisterModal(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-gray-300 hover:bg-zinc-800">
                  Cancel
                </button>
                <button onClick={confirmUnregister} disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50">
                  {submitting ? "Processing..." : "Unregister"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Team Selector Overlay */}
        {showSelector && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <div className="min-h-screen flex items-start justify-center p-4 pt-20">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl shadow-2xl max-h-[85vh] overflow-y-auto">
                <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
                  <h3 className="font-bold text-white">Pick Your Team — First Come Gets Fav</h3>
                  <button onClick={() => setShowSelector(false)} className="text-gray-400 hover:text-white p-1">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6">
                  <NbaTeamSelector availableTeams={availableTeams} onTeamSelected={handleTeamSelected} mode="register" />
                  {submitting && pendingTeam && <p className="text-center text-sm text-orange-400 mt-4">Locking {pendingTeam}...</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl border border-orange-500/20 shadow-2xl shadow-orange-500/5">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600 via-red-600 to-zinc-900" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.08),_transparent_60%)]" />
          <div className="relative p-8 md:p-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-md px-4 py-1.5 text-sm text-white">
              <Trophy className="w-3.5 h-3.5 text-yellow-300" /> GAMEPOINT NBA PLAYOFFS
            </div>
            <h1 className="mt-5 text-5xl md:text-7xl font-black tracking-wider text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              NBA <span className="text-yellow-300">PLAYOFFS</span>
            </h1>
            <p className="mt-2 text-xl md:text-2xl text-orange-100 font-semibold tracking-wider">SEASON 1 — 16 TEAM BRACKET</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-sm text-white">1 Player = 1 Team</span>
              <span className="rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-sm text-white">First-Come Gets Fav Team</span>
              <span className="rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-sm text-white">Single Elimination</span>
              <span className="rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-2 text-sm text-white">16 Players</span>
              <span className={`rounded-full border backdrop-blur-sm px-4 py-2 text-sm font-bold ${tournamentStarted ? "border-green-400 bg-green-500 text-white" : isFull ? "border-red-400 bg-red-500 text-white" : "border-yellow-300 bg-yellow-400 text-zinc-900"}`}>
                {tournamentStarted ? "Tournament Started" : isFull ? "Full" : `${spotsLeft} Spots Left`}
              </span>
            </div>
            <p className="mt-6 max-w-2xl text-white/90 leading-relaxed">
              Pick your NBA team before someone else does — each of the 30 teams can only be chosen once. First 8 registrants form <span className="font-bold text-red-200">East</span>, next 8 form <span className="font-bold text-blue-200">West</span>. When the 16th team locks, the bracket auto-generates: <span className="font-bold">1v8, 4v5, 3v6, 2v7</span> per conference. Tournament begins automatically at 16.
            </p>
            <div className="mt-8 flex flex-wrap gap-8">
              <div>
                <div className="text-sm text-white/70">Format</div>
                <div className="text-lg font-bold text-white">East vs West Playoffs</div>
              </div>
              <div>
                <div className="text-sm text-white/70">Slots</div>
                <div className="text-lg font-bold text-white">16 Teams</div>
              </div>
              <div>
                <div className="text-sm text-white/70">Champion</div>
                <div className="text-lg font-bold text-yellow-300">🏆 TBD</div>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESS */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-orange-400" />
            <h2 className="font-bold text-white">Registration Progress — {tournamentStarted ? "Complete — Tournament Started!" : `${spotsLeft} spots left`}</h2>
          </div>
          <div className="flex justify-between text-sm text-gray-400 mb-3">
            <span>Players Registered</span>
            <span className="text-white font-bold">{registeredCount} / {MAX_PLAYERS} {tournamentStarted && <span className="text-green-400">• Bracket Locked</span>}</span>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${tournamentStarted ? "bg-gradient-to-r from-green-500 to-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-gradient-to-r from-orange-600 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"}`} style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <span>East: {eastCount}/8 · West: {westCount}/8</span>
            <span className="flex items-center gap-1">{tournamentStarted ? <Zap className="w-3 h-3 text-green-400" /> : <Clock className="w-3 h-3" />} {tournamentStarted ? "First Round generated — check bracket below" : "Tournament auto-starts when 16 teams complete"}</span>
          </div>
        </div>

        {/* TOURNAMENT LAYOUT */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-black text-white mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-pink-400" /> Tournament Layout
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 text-center">
              <div className="text-zinc-400 text-sm mb-2">Format</div>
              <div className="font-bold text-white">Single Elimination</div>
              <div className="text-sm text-gray-400 mt-2">1v8, 4v5, 3v6, 2v7 per conference</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 text-center">
              <div className="text-4xl mb-2">🏆</div>
              <div className="font-bold text-white">Champion</div>
              <div className="text-sm text-gray-400 mt-1">East Winner vs West Winner</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 text-center">
              <div className="text-zinc-400 text-sm mb-2">Total Matches</div>
              <div className="font-bold text-lg text-white">15</div>
              <div className="text-sm text-gray-400 mt-2">8 First Round + 7 later</div>
            </div>
          </div>
        </div>

        {/* PLAYER SLOTS */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
          <div className="flex items-center justify-between mb-6 gap-4">
            <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
              <Swords className="w-5 h-5 text-orange-400" /> Tournament Slots
            </h2>
            {!tournamentStarted && !currentUserRegistered && !isFull && currentUser && (
              <button onClick={() => setShowSelector(true)} className="hidden sm:inline-flex px-4 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-orange-600 to-red-500 hover:from-orange-500 hover:to-red-400 text-sm">
                Pick Your Team
              </button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {orderedPlayers.map((player, index) => {
              const isOwnSlot = player?.id === currentUser?.id;
              const isEmpty = !player;
              const slotTeamInfo = player?.team ? TEAM_CONFERENCES[player.team] : null;

              return (
                <div
                  key={index}
                  onClick={() => handleSlotClick(player)}
                  className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${isEmpty && !tournamentStarted && !isFull ? "border-dashed border-green-500/40 bg-zinc-950/40 cursor-pointer hover:border-green-500 hover:bg-zinc-900/60" : isOwnSlot ? "border-orange-500/50 bg-zinc-900 cursor-pointer hover:border-orange-400" : isEmpty ? "border-zinc-800 bg-zinc-950/30" : "border-zinc-800 bg-zinc-950/60"}`}
                >
                  <div className="flex items-center gap-3">
                    {player?.team ? (
                      <img src={getTeamLogo(player.team)} alt={player.team} loading="lazy" className={`w-10 h-10 object-contain bg-white rounded-full p-1 border-2 ${isOwnSlot ? "border-orange-500/60" : "border-zinc-700"}`} onError={(e) => ((e.currentTarget.style.display = "none"))} />
                    ) : player?.avatar_url ? (
                      <img src={player.avatar_url} alt={player.name} className={`w-10 h-10 rounded-full object-cover border-2 ${isOwnSlot ? "border-orange-500/60" : "border-zinc-700"}`} />
                    ) : (
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-black ${isEmpty ? "bg-zinc-800/50 border-dashed border-zinc-600 text-gray-600" : isOwnSlot ? "bg-orange-500/20 border-orange-500/40 text-orange-300" : "bg-zinc-800 border-zinc-700 text-gray-300"}`}>
                        {player ? player.name.charAt(0).toUpperCase() : "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-gray-500 font-medium tracking-wider">SLOT #{index + 1} {index < 8 ? "· EAST" : "· WEST"}</div>
                      <div className={`font-bold truncate text-sm ${player ? "text-white" : "text-gray-500"}`}>{player?.name || (isEmpty && !tournamentStarted ? "Available" : tournamentStarted ? "Locked" : "Full")}</div>
                    </div>
                    <div className={`text-[10px] font-bold px-2 py-1 rounded-full border ${isOwnSlot ? "bg-orange-500/15 text-orange-300 border-orange-500/20" : player ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-zinc-800 text-gray-500 border-zinc-700"}`}>
                      {isOwnSlot ? "You" : player ? "Locked" : isEmpty && tournamentStarted ? "Closed" : "Open"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs truncate">
                      {player?.team ? (
                        <span className="font-semibold text-white">{player.team}</span>
                      ) : isEmpty && !tournamentStarted && !isFull ? (
                        <span className="text-green-400/70">Click to pick team</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </div>
                    {slotTeamInfo && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${slotTeamInfo.conference === "East" ? "border-red-500/20 text-red-400 bg-red-500/10" : "border-blue-500/20 text-blue-400 bg-blue-500/10"}`}>{slotTeamInfo.conference}</span>}
                  </div>
                  {player && <div className="text-[11px] text-gray-500">{player.points ?? 0} Points · {slotTeamInfo?.division || ""}</div>}
                  {isEmpty && !currentUser && !tournamentStarted && <LogIn className="w-3 h-3 text-gray-600 ml-auto" />}
                </div>
              );
            })}
          </div>

          {!currentUser && !tournamentStarted && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-center">
              <p className="text-sm text-gray-400">
                <button onClick={() => router.push("/login")} className="text-orange-400 hover:text-orange-300 underline font-medium">
                  Log in
                </button>{" "}
                to pick your team — first come gets fav team.
              </p>
            </div>
          )}
          {currentUserRegistered && !tournamentStarted && (
            <p className="mt-3 text-xs text-center text-orange-300/70">You are in as {currentUserPlayer?.team} — click your slot to leave before tournament starts.</p>
          )}
          {tournamentStarted && <p className="mt-3 text-xs text-center text-green-400 font-semibold">Bracket locked — tournament has begun. No more registrations or leaves.</p>}
        </div>

        {/* BRACKET VIEW — only when 16 */}
        {tournamentStarted && bracket ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-black text-white mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" /> Playoff Bracket — First Round
            </h2>
            <p className="text-sm text-gray-400 mb-6">Auto-generated when 16th team locked. Seeds by registration order within each conference (first East = 1-seed). Winners advance via <code className="text-orange-300">/api/tournament/matches</code>.</p>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* East */}
              <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-4">
                <h3 className="font-black text-red-300 mb-3 flex items-center gap-2">East Conference <span className="text-xs font-normal text-red-300/70">seeds 1-8</span></h3>
                <div className="space-y-3">
                  {bracket.east.firstRoundMatchups.map((m) => (
                    <div key={m.matchId} className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-3 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500">Seed {m.seed1} vs Seed {m.seed2 ?? m.seed8}</div>
                        <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap"><img src={getTeamLogo(m.team1)} alt={m.team1} loading="lazy" className="w-7 h-7 object-contain bg-white rounded-full p-1" onError={(e) => ((e.currentTarget.style.display = "none"))} /> {m.team1} <span className="text-gray-500 font-normal">vs</span> {m.team2} <img src={getTeamLogo(m.team2)} alt={m.team2} loading="lazy" className="w-7 h-7 object-contain bg-white rounded-full p-1" onError={(e) => ((e.currentTarget.style.display = "none"))} /></div>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-gray-400 border border-zinc-700">{m.matchId}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* West */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4">
                <h3 className="font-black text-blue-300 mb-3 flex items-center gap-2">West Conference <span className="text-xs font-normal text-blue-300/70">seeds 1-8</span></h3>
                <div className="space-y-3">
                  {bracket.west.firstRoundMatchups.map((m) => (
                    <div key={m.matchId} className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-3 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-xs text-gray-500">Seed {m.seed1} vs Seed {m.seed2 ?? m.seed8}</div>
                        <div className="font-bold text-white text-sm flex items-center gap-1.5 flex-wrap"><img src={getTeamLogo(m.team1)} alt={m.team1} loading="lazy" className="w-7 h-7 object-contain bg-white rounded-full p-1" onError={(e) => ((e.currentTarget.style.display = "none"))} /> {m.team1} <span className="text-gray-500 font-normal">vs</span> {m.team2} <img src={getTeamLogo(m.team2)} alt={m.team2} loading="lazy" className="w-7 h-7 object-contain bg-white rounded-full p-1" onError={(e) => ((e.currentTarget.style.display = "none"))} /></div>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-gray-400 border border-zinc-700">{m.matchId}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {matches.length > 0 && (
              <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <h4 className="font-bold text-white mb-2 text-sm">Persisted Matches ({matches.length})</h4>
                <div className="text-xs text-gray-500">First Round matches are saved in <code>tournament_matches</code> — update winners via API to advance.</div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-black text-white mb-2 flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" /> Bracket Preview
            </h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              Bracket unlocks automatically when the 16th player locks their team. Until then, keep picking — remember, <span className="text-orange-300 font-semibold">first come gets fav team</span>.
            </p>
            <div className="mt-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-4 text-center">
              <div className="text-3xl mb-2">🏀</div>
              <div className="text-sm text-gray-300 font-semibold">{spotsLeft} more {spotsLeft === 1 ? "team" : "teams"} needed to start</div>
              <div className="text-xs text-gray-500 mt-1">East 1st 8 → West next 8 · Seeds by registration order · 1v8, 4v5, 3v6, 2v7</div>
            </div>
          </div>
        )}

        {/* CHAMPION */}
        <div className="rounded-2xl border border-yellow-500/20 bg-zinc-900/60 backdrop-blur-md p-8 md:p-12 text-center shadow-2xl shadow-yellow-500/5">
          <div className="text-6xl md:text-7xl mb-4">🏆</div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
            NBA <span className="text-yellow-400">Champion</span> — TBD
          </h2>
          <p className="text-gray-300 max-w-xl mx-auto leading-relaxed text-sm">When 16 teams lock, First Round tips off. Win your conference bracket to reach the Finals. May the best team win.</p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
