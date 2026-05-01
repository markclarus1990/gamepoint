import { supabase } from "@/lib/supabase";

export async function POST(req) {
  const { name, points } = await req.json();

  // 1. get user
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("name", name)
    .single();

  if (!user) {
    return Response.json({ error: "User not found" });
  }

  // 2. CHECK existing pending request
  const { data: existing } = await supabase
    .from("redeem_requests")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return Response.json({
      error: "You already have a pending request",
    });
  }

  // 3. insert new request
  const { error } = await supabase
    .from("redeem_requests")
    .insert({
      user_id: user.id,
      points_used: points,
      minutes: points / 2.5,
      status: "pending",
    });

  if (error) {
    return Response.json({ error: error.message });
  }

  return Response.json({ success: true });
}