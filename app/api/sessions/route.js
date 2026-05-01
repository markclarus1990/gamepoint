import { supabase } from "@/lib/supabase";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");

  // 1. GET USER (to get user_id)
  const { data: user } = await supabase
    .from("users")
    .select("id")
    .eq("name", name)
    .single();

  if (!user) {
    return Response.json([]);
  }

  // 2. GET SESSIONS
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_name", name);

  // 3. GET REDEEMS
  const { data: redeems } = await supabase
    .from("redeem_requests")
    .select("*")
    .eq("user_id", user.id);

  // 4. MAP TYPES (VERY IMPORTANT)
  const formattedSessions = (sessions || []).map((s) => ({
    ...s,
    type: "session",
    status: "paid", // optional label
    amount: s.amount,
  }));

  const formattedRedeems = (redeems || []).map((r) => ({
    ...r,
    type: "redeem",
    amount: r.points_used, // normalize field
  }));

  // 5. MERGE + SORT
  const history = [...formattedSessions, ...formattedRedeems].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return Response.json(history);
}