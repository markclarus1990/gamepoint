import { supabase } from "@/lib/supabase";

export async function POST(req) {
  const { name, points } = await req.json();

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("name", name)
    .single();

  if (!user) return Response.json({ error: "User not found" });

  if (points % 20 !== 0)
    return Response.json({ error: "Must be multiple of 20" });

  if (points > user.points)
    return Response.json({ error: "Not enough points" });

  const minutes = (points / 20) * 8;

  await supabase.from("redeem_requests").insert({
    user_id: user.id,
    points_used: points,
    minutes,
  });

  return Response.json({ success: true });
}