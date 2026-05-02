import { supabase } from "@/lib/supabase";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // 1. GET USER
  const { data: user } = await supabase
    .from("users")
    .select("id, name, avatar_url")
    .eq("id", id)
    .single();

  if (!user) {
    return Response.json({ user: null, history: [] });
  }

  // 2. GET SESSIONS (use user_id instead of name 🔥)
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user.id);

  // 3. GET REDEEMS
  const { data: redeems } = await supabase
    .from("redeem_requests")
    .select("*")
    .eq("user_id", user.id);

  // 4. FORMAT
  const formattedSessions = (sessions || []).map((s) => ({
    ...s,
    type: "session",
    status: "paid",
    amount: s.amount,
  }));

  const formattedRedeems = (redeems || []).map((r) => ({
    ...r,
    type: "redeem",
    amount: r.points_used,
  }));

  const history = [...formattedSessions, ...formattedRedeems].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return Response.json({
    user,
    history,
  });
}