import { supabase } from "@/lib/supabase";

export async function GET() {

  const { data: sessions, error } = await supabase
    .from("sessions")
    .select(`
      user_name,
      minutes
    `);

  if (error) {
    return Response.json([]);
  }

  // GROUP BY USER NAME
  const leaderboard = Object.values(
    (sessions || []).reduce((acc: any, session: any) => {

      if (!acc[session.user_name]) {
        acc[session.user_name] = {
          name: session.user_name,
          total_minutes: 0,
        };
      }

      acc[session.user_name].total_minutes +=
        session.minutes || 0;

      return acc;

    }, {})
  )

  // SORT BY MOST PLAYTIME
  .sort(
    (a: any, b: any) =>
      b.total_minutes - a.total_minutes
  );

  // GET USER AVATARS
  const names = leaderboard.map((u: any) => u.name);

  const { data: users } = await supabase
    .from("users")
    .select("name, avatar_url")
    .in("name", names);

  const finalLeaderboard = leaderboard.map((player: any) => ({
    ...player,
    avatar_url:
      users?.find((u) => u.name === player.name)
        ?.avatar_url ||
      "https://placehold.co/100x100/png",
  }));

  return Response.json(finalLeaderboard);
}