export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";
import { Swords, Trophy, Users, Target } from "lucide-react";
import Footer from "@/app/components/Footer";

export default async function TekkenPage() {
  const { data: registrations } = await supabase
    .from("tournament_registrations")
    .select("user_id, created_at")
    .order("created_at", { ascending: true });

  const userIds = registrations?.map((r) => r.user_id) || [];

  const { data: players } = await supabase
    .from("users")
    .select("id, name, avatar_url, points")
    .in("id", userIds);

  const playerMap = new Map(
    (players || []).map((player) => [player.id, player])
  );

  const orderedPlayers =
    registrations
      ?.map((registration) => playerMap.get(registration.user_id))
      .filter(Boolean) || [];

  const maxPlayers = 8;
  const registeredCount = orderedPlayers.length;
  const progress = (registeredCount / maxPlayers) * 100;

  const playerSlots = Array.from(
    { length: maxPlayers },
    (_, index) => orderedPlayers[index] || null
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 space-y-8">

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
              <span className="rounded-full border border-green-500/30 bg-green-500/10 backdrop-blur-sm px-4 py-2 text-sm text-green-400">
                Registration Open
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
              {registeredCount} / {maxPlayers}
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
            {playerSlots.map((player, index) => (
              <div
                key={index}
                className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm p-4 flex items-center justify-between hover:border-pink-500/20 hover:bg-zinc-950 transition-all group"
              >
                <div className="flex items-center gap-4">
                  {player?.avatar_url ? (
                    <img
                      src={player.avatar_url}
                      alt={player.name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-zinc-700 group-hover:border-pink-500/40 transition-colors"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-lg font-bold text-gray-400 group-hover:border-pink-500/40 transition-colors">
                      {player ? player.name.charAt(0).toUpperCase() : "?"}
                    </div>
                  )}
                  <div>
                    <div className="text-xs text-gray-500 font-medium tracking-wider">
                      SLOT #{index + 1}
                    </div>
                    <div
                      className={`font-bold text-base ${
                        player ? "text-white" : "text-gray-500"
                      }`}
                    >
                      {player?.name || "TBD"}
                    </div>
                    <div className="text-xs text-gray-400">
                      {player
                        ? `${player.points} Points`
                        : "Available Slot"}
                    </div>
                  </div>
                </div>

                <div
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    player
                      ? "bg-green-500/10 text-green-400 border border-green-500/20"
                      : "bg-zinc-800/50 text-gray-500 border border-zinc-700"
                  }`}
                >
                  {player ? "Registered" : "Open"}
                </div>
              </div>
            ))}
          </div>
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
