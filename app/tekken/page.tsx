import { supabase } from "@/lib/supabase";

export default async function TekkenPage() {
  const { data: players } = await supabase
    .from("tournament_registrations")
    .select(`
      user_id,
      users (
        id,
        name,
        avatar_url,
        points
      )
    `);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-bold">
        GAMEPOINT TEKKEN 7 TOURNAMENT
      </h1>

      <h2 className="mt-8 text-2xl font-bold">
        Registered Players
      </h2>

      <div className="mt-4 space-y-3">
        {players?.map((player) => (
          <div
            key={player.user_id}
            className="border rounded-lg p-3"
          >
            {player.users?.name}
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-2xl font-bold">
        Tournament Bracket
      </h2>

      <div className="border rounded-lg p-10 mt-4">
        Bracket Coming Soon
      </div>
    </div>
  );
}