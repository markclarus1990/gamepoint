import { supabase } from "@/lib/supabase";

// GET → find user + history
export async function GET(req) {

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (!user) {
    return Response.json({
      error: "User not found",
    });
  }

  // SESSIONS
const { data: sessions } = await supabase
  .from("sessions")
  .select("*")
  .eq("user_name", user.name);

  // REDEEMS
  const { data: redeems } = await supabase
    .from("redeem_requests")
    .select("*")
    .eq("user_id", user.id);

  // TOTAL PLAYTIME
  const totalMinutes = (sessions || []).reduce(
    (sum, s) => sum + (s.minutes || 0),
    0
  );

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  // FORMAT SESSIONS
  const formattedSessions = (sessions || []).map((s) => ({
    ...s,
    type: "session",
    amount: s.amount,
  }));

  // FORMAT REDEEMS
  const formattedRedeems = (redeems || []).map((r) => ({
    ...r,
    type: "redeem",
    amount: r.points_used,
  }));

  // MERGE HISTORY
  const history = [
    ...formattedSessions,
    ...formattedRedeems,
  ].sort(
    (a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
  );

  return Response.json({
    user,

    stats: {
      total_minutes: totalMinutes,
      total_hours: `${totalHours}h ${remainingMinutes}m`,
    },

    history,
  });
}