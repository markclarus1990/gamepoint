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

  if (!user) return Response.json({ error: "User not found" });

  // 🔥 ADD THIS BACK
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_name", user.name); // ✅ FIX

  const { data: redeems } = await supabase
    .from("redeem_requests")
    .select("*")
    .eq("user_id", user.id);

  const formattedSessions = (sessions || []).map((s) => ({
    ...s,
    type: "session",
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
    history, // ✅ BACK AGAIN
  });
}