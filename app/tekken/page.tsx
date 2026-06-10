import { supabase } from "@/lib/supabase";

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

console.log("Registrations:", registrations);
console.log("User IDs:", userIds);
console.log("Players:", players);
console.log("Ordered Players:", orderedPlayers);
console.log("Registered Count:", registeredCount);

return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
    {/* Hero */}
<div
  className="relative overflow-hidden rounded-3xl border border-red-500/20"
  style={{
    backgroundImage:
      "url('https://mwdcrfmqppwwqokfiwga.supabase.co/storage/v1/object/sign/image/tekken7.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9mMDY2MTcwYi1kNzFhLTQxMWYtYmExNC1lN2FmMDVkNjIxOTgiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJpbWFnZS90ZWtrZW43LnBuZyIsImlhdCI6MTc4MDcxNzAwMywiZXhwIjoxODEyMjUzMDAzfQ.fH-O9QjK5tRqAN-JDwBvVlT1nFYyQZp-qkhLta9Ja9A')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  }}
>
  <div className="absolute inset-0 bg-black/75" />

  <div className="relative p-10">
    <div className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1 text-sm text-red-400">
      GAMEPOINT TOURNAMENT SERIES
    </div>

    <h1 className="mt-4 text-6xl font-black tracking-wider text-white">
      TEKKEN 7
    </h1>

    <p className="mt-2 text-2xl text-zinc-300">
      SEASON 1
    </p>

    <div className="mt-6 flex flex-wrap gap-3">
      <span className="rounded-full border border-zinc-700 bg-black/40 px-4 py-2">
        Entry Fee ₱50
      </span>

      <span className="rounded-full border border-zinc-700 bg-black/40 px-4 py-2">
        Round Robin
      </span>

      <span className="rounded-full border border-zinc-700 bg-black/40 px-4 py-2">
        8 Players
      </span>

      <span className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-green-400">
        Registration Open
      </span>
    </div>

    <div className="mt-8 max-w-2xl">
      <p className="text-lg text-zinc-300">
        Battle every competitor in a full Round Robin format.
        The player with the best overall record will be crowned
        the first GamePoint Tekken 7 Champion.
      </p>
    </div>

    <div className="mt-8 flex gap-8">
      <div>
        <div className="text-sm text-zinc-400">
          Tournament Format
        </div>

        <div className="text-xl font-bold">
          Round Robin
        </div>
      </div>

      <div>
        <div className="text-sm text-zinc-400">
          Total Players
        </div>

        <div className="text-xl font-bold">
          8 Slots
        </div>
      </div>

      <div>
        <div className="text-sm text-zinc-400">
          Champion
        </div>

        <div className="text-xl font-bold text-yellow-400">
          🏆 TBD
        </div>
      </div>
    </div>
  </div>
</div>

      {/* Progress */}
      <div className="rounded-2xl border p-6">
        <div className="flex justify-between mb-3">
          <span className="font-semibold">
            Registration Progress
          </span>

          <span>
            {registeredCount} / {maxPlayers}
          </span>
        </div>

        <div className="h-4 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tournament Layout */}
      <div className="rounded-2xl border p-6">
        <h2 className="text-2xl font-bold mb-6">
          Tournament Layout
        </h2>

        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div className="border rounded-xl p-6">
            <div className="text-zinc-400 mb-2">
              Format
            </div>

            <div className="font-bold text-xl">
              Round Robin
            </div>

            <div className="text-sm text-zinc-500 mt-2">
              Everyone fights everyone
            </div>
          </div>

          <div className="border rounded-xl p-6">
            <div className="text-5xl mb-3">
              🏆
            </div>

            <div className="font-bold text-xl">
              Champion
            </div>

            <div className="text-sm text-zinc-500 mt-2">
              Best overall record
            </div>
          </div>

          <div className="border rounded-xl p-6">
            <div className="text-zinc-400 mb-2">
              Total Matches
            </div>

            <div className="font-bold text-xl">
              28
            </div>

            <div className="text-sm text-zinc-500 mt-2">
              For 8 participants
            </div>
          </div>
        </div>
      </div>

      {/* Player Slots */}
      <div className="rounded-2xl border p-6">
        <h2 className="text-2xl font-bold mb-6">
          Tournament Slots
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          {playerSlots.map((player, index) => (
            <div
              key={index}
              className="border rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <div className="text-sm text-zinc-500">
                  Slot #{index + 1}
                </div>

                <div className="font-bold text-lg">
                  {player?.name || "TBD"}
                </div>

                <div className="text-sm text-zinc-400">
                  {player
                    ? `${player.points} Points`
                    : "Available Slot"}
                </div>
              </div>

              <div>
                {player?.avatar_url ? (
                  <img
                    src={player.avatar_url}
                    alt={player.name}
                    className="w-14 h-14 rounded-full object-cover border border-zinc-700"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-xl">
                    {player ? player.name.charAt(0).toUpperCase() : "?"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Match Matrix Preview */}
      <div className="rounded-2xl border p-6">
        <h2 className="text-2xl font-bold mb-4">
          Match Schedule Preview
        </h2>

        <div className="text-zinc-400">
          Once all 8 slots are filled, every participant
          will face all other participants in a Round Robin format.
        </div>

        <div className="mt-4 border rounded-xl p-4">
          <div>Player 1 vs Player 2</div>
          <div>Player 1 vs Player 3</div>
          <div>Player 1 vs Player 4</div>
          <div className="text-zinc-500 mt-2">
            ...and so on until all 28 matches are completed.
          </div>
        </div>
      </div>

      {/* Champion */}
      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-950/10 p-8 text-center">
        <div className="text-6xl mb-4">
          🏆
        </div>

        <h2 className="text-3xl font-bold">
          Season 1 Champion
        </h2>

        <p className="text-zinc-400 mt-2">
          Complete all Round Robin matches to determine
          the first GamePoint Tekken 7 Champion.
        </p>
      </div>
    </div>
  );
}