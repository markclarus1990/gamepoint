"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Swords, Users, Target, X, LogIn } from "lucide-react";
import Footer from "@/app/components/Footer";
import { useRouter } from "next/navigation";

interface PlayerInfo {
  id: string;
  name: string;
  avatar_url: string | null;
  points: number;
}

interface Registration {
  user_id: string;
  created_at: string;
}

const MAX_PLAYERS = 8;

export default function TekkenPage() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
  } | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("user");
        if (stored) {
          const parsed = JSON.parse(stored);
          return { id: parsed.id, name: parsed.name };
        }
      } catch {}
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<"register" | "unregister">("register");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isFull, setIsFull] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchData = useCallback(async () => {
    const { data: regs } = await supabase
      .from("tournament_registrations")
      .select("user_id, created_at")
      .order("created_at", { ascending: true });

    const regArray = regs || [];
    setRegistrations(regArray);
    setIsFull(regArray.length >= MAX_PLAYERS);

    const userIds = regArray.map((r) => r.user_id);
    if (userIds.length > 0) {
      const { data: playerData } = await supabase
        .from("users")
        .select("id, name, avatar_url, points")
        .in("id", userIds);
      setPlayers(playerData || []);
    } else {
      setPlayers([]);
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const orderedPlayers: (PlayerInfo | null)[] = Array.from(
    { length: MAX_PLAYERS },
    (_, i) => {
      const reg = registrations[i];
      return reg ? playerMap.get(reg.user_id) || null : null;
    }
  );

  const registeredCount = registrations.length;
  const progress = (registeredCount / MAX_PLAYERS) * 100;

  const currentUserRegistered = registrations.some(
    (r) => r.user_id === currentUser?.id
  );

  function handleSlotClick(player: PlayerInfo | null, index: number) {
    if (submitting) return;

    if (!currentUser) {
      router.push("/login");
      return;
    }

    if (player) {
      if (player.id === currentUser.id) {
        setModalAction("unregister");
        setModalOpen(true);
      }
      return;
    }

    setModalAction("register");
    setModalOpen(true);
  }

  async function confirmAction() {
    if (!currentUser) return;
    setSubmitting(true);
    setModalOpen(false);

    try {
      if (modalAction === "register") {
        const res = await fetch("/api/tournament/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: currentUser.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || "Registration failed", "error");
        } else {
          showToast("Successfully registered!", "success");
          await fetchData();
        }
      } else {
        const res = await fetch("/api/tournament/register", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: currentUser.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || "Failed to unregister", "error");
        } else {
          showToast("Successfully unregistered", "success");
          await fetchData();
        }
      }
    } catch {
      showToast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 space-y-8">

        {/* TOAST */}
        {toast && (
          <div
            className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-white font-semibold text-sm transition-all ${
              toast.type === "success"
                ? "bg-green-600 border border-green-400"
                : "bg-red-600 border border-red-400"
            }`}
          >
            {toast.message}
          </div>
        )}

        {/* CONFIRMATION MODAL */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">
                  {modalAction === "register"
                    ? "Register for Tournament?"
                    : "Unregister from Tournament?"}
                </h3>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-300 text-sm mb-6">
                {modalAction === "register"
                  ? "You are about to join Tekken 7 Season 1. Are you sure?"
                  : "You are about to leave the tournament. Your slot will open up for others."}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-gray-300 font-medium hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  disabled={submitting}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white transition-all ${
                    modalAction === "register"
                      ? "bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400"
                      : "bg-zinc-700 hover:bg-zinc-600"
                  } disabled:opacity-50`}
                >
                  {submitting
                    ? "Processing..."
                    : modalAction === "register"
                      ? "Confirm"
                      : "Unregister"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl border border-red-500/20 shadow-2xl shadow-red-500/5">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://mwdcrfmqppwwqokfiwga.supabase.co/storage/v1/object/sign/image/tekken7.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9mMDY2MTcwYi1kNzFhLTQxMWYtYmExNC1lN2FmMDVkNjIxOTgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS90ZWtrZW43LnBuZyIsImlhdCI6MTc4MDcxNzAwMywiZXhwIjoxODEyMjUzMDAzfQ.fH-O9QjK5tRqAN-JDwBvVlT1nFYyQZp-qkhLta9Ja9A')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-zinc-950" />

          <div className="relative p-8 md:p-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 backdrop-blur-md px-4 py-1.5 text-sm text-red-400">
              <Swords className="w-3.5 h-3.5" />
              GAMEPOINT TOURNAMENT SERIES
            </div>

            <h1 className="mt-5 text-5xl md:text-7xl font-black tracking-wider text-white drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              TEKKEN 7
            </h1>

            <p className="mt-2 text-xl md:text-2xl text-orange-400 font-semibold tracking-wider">
              SEASON 1
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full border border-zinc-700 bg-zinc-900/80 backdrop-blur-sm px-4 py-2 text-sm text-gray-200">
                Entry Fee ₱50
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900/80 backdrop-blur-sm px-4 py-2 text-sm text-gray-200">
                Round Robin
              </span>
              <span className="rounded-full border border-zinc-700 bg-zinc-900/80 backdrop-blur-sm px-4 py-2 text-sm text-gray-200">
                8 Players
              </span>
              <span className={`rounded-full border backdrop-blur-sm px-4 py-2 text-sm ${
                isFull
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-green-500/30 bg-green-500/10 text-green-400"
              }`}>
                {isFull ? "Full" : "Registration Open"}
              </span>
            </div>

            <div className="mt-8 max-w-2xl">
              <p className="text-base md:text-lg text-gray-200 leading-relaxed">
                Battle every competitor in a full Round Robin format.
                The player with the best overall record will be crowned
                the first GamePoint Tekken 7 Champion.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap gap-8">
              <div>
                <div className="text-sm text-gray-400">Format</div>
                <div className="text-lg font-bold text-white">Round Robin</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Slots</div>
                <div className="text-lg font-bold text-white">8 Players</div>
              </div>
              <div>
                <div className="text-sm text-gray-400">Champion</div>
                <div className="text-lg font-bold text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.3)]">
                  🏆 TBD
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PROGRESS */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-red-400" />
            <h2 className="font-bold text-white">Registration Progress</h2>
          </div>
          <div className="flex justify-between text-sm text-gray-400 mb-3">
            <span>Players Registered</span>
            <span className="text-white font-semibold">
              {registeredCount} / {MAX_PLAYERS}
            </span>
          </div>
          <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-600 to-orange-500 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* TOURNAMENT LAYOUT */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-black text-white mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-pink-400" />
            Tournament Layout
          </h2>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm p-6 text-center hover:border-pink-500/20 transition-colors">
              <div className="text-zinc-400 text-sm mb-2">Format</div>
              <div className="font-bold text-lg text-white">Round Robin</div>
              <div className="text-sm text-gray-400 mt-2">
                Everyone fights everyone
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm p-6 text-center hover:border-yellow-500/20 transition-colors">
              <div className="text-4xl mb-3">🏆</div>
              <div className="font-bold text-lg text-white">Champion</div>
              <div className="text-sm text-gray-400 mt-2">
                Best overall record
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm p-6 text-center hover:border-orange-500/20 transition-colors">
              <div className="text-zinc-400 text-sm mb-2">Total Matches</div>
              <div className="font-bold text-lg text-white">28</div>
              <div className="text-sm text-gray-400 mt-2">
                For 8 participants
              </div>
            </div>
          </div>
        </div>

        {/* PLAYER SLOTS */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-black text-white mb-6 flex items-center gap-2">
            <Swords className="w-5 h-5 text-orange-400" />
            Tournament Slots
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            {orderedPlayers.map((player, index) => {
              const isOwnSlot = player?.id === currentUser?.id;
              const isEmpty = !player;

              return (
                <div
                  key={index}
                  onClick={() => handleSlotClick(player, index)}
                  className={`rounded-xl border bg-zinc-950/80 backdrop-blur-sm p-4 flex items-center justify-between transition-all ${
                    isEmpty && !isFull
                      ? "border-dashed border-green-500/40 cursor-pointer hover:border-green-500 hover:bg-zinc-900/80"
                      : isOwnSlot
                        ? "border-red-500/40 cursor-pointer hover:border-red-500 hover:bg-zinc-900/80"
                        : "border-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {player?.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt={player.name}
                        className={`w-12 h-12 rounded-full object-cover border-2 transition-colors ${
                          isOwnSlot
                            ? "border-red-500/60"
                            : "border-zinc-700"
                        }`}
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-lg font-bold transition-colors ${
                        isEmpty
                          ? "bg-zinc-800/50 border-dashed border-zinc-600 text-gray-500"
                          : "bg-zinc-800 border-zinc-700 text-gray-400"
                      }`}>
                        {player ? player.name.charAt(0).toUpperCase() : "?"}
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-500 font-medium tracking-wider">
                        SLOT #{index + 1}
                      </div>
                      <div className={`font-bold text-base ${
                        player ? "text-white" : "text-gray-500"
                      }`}>
                        {player?.name || (isEmpty && !isFull ? "Available Slot" : isFull ? "Full" : "TBD")}
                      </div>
                      <div className="text-xs text-gray-400">
                        {player
                          ? `${player.points} Points`
                          : isEmpty && isFull
                            ? "Slot unavailable"
                            : "Click to register"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isEmpty && !currentUser && (
                      <LogIn className="w-4 h-4 text-gray-500" />
                    )}
                    <div className={`text-xs font-semibold px-3 py-1 rounded-full ${
                      isOwnSlot
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : player
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : isEmpty && isFull
                            ? "bg-zinc-800/50 text-gray-600 border border-zinc-700"
                            : "bg-green-500/5 text-green-500/60 border border-green-500/20"
                    }`}>
                      {isOwnSlot
                        ? "You"
                        : player
                          ? "Registered"
                          : isEmpty && isFull
                            ? "Full"
                            : "Open"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!currentUser && !isFull && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4 text-center">
              <p className="text-sm text-gray-400">
                <button
                  onClick={() => router.push("/login")}
                  className="text-red-400 hover:text-red-300 underline font-medium"
                >
                  Log in
                </button>{" "}
                to register for this tournament.
              </p>
            </div>
          )}
        </div>

        {/* MATCH SCHEDULE PREVIEW */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-black text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            Match Schedule Preview
          </h2>

          <p className="text-gray-300 leading-relaxed">
            Once all 8 slots are filled, every participant will face all other
            participants in a Round Robin format. Each match will be a best-of-3
            series.
          </p>

          <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm p-4 space-y-2">
            <div className="text-sm text-gray-400">Player 1 vs Player 2</div>
            <div className="text-sm text-gray-400">Player 1 vs Player 3</div>
            <div className="text-sm text-gray-400">Player 1 vs Player 4</div>
            <div className="text-sm text-gray-500 mt-2">
              ...and so on until all 28 matches are completed.
            </div>
          </div>
        </div>

        {/* CHAMPION */}
        <div className="rounded-2xl border border-yellow-500/20 bg-zinc-900/60 backdrop-blur-md p-8 md:p-12 text-center shadow-2xl shadow-yellow-500/5">
          <div className="text-6xl md:text-7xl mb-4">🏆</div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
            Season 1 <span className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]">Champion</span>
          </h2>
          <p className="text-gray-300 max-w-xl mx-auto leading-relaxed">
            Complete all Round Robin matches to determine the first GamePoint
            Tekken 7 Champion. May the best player win.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
