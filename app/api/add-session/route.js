import { supabase } from "@/lib/supabase";

export async function POST(req) {
  const { name, amount, minutes, points } = await req.json();

  // 1. Save session
  await supabase.from("sessions").insert({
    user_name: name,
    amount,
    minutes,
    points,
    user_id
  });

  // 2. Add points to user
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("name", name)
    .single();

  if (user) {
    await supabase
      .from("users")
      .update({
        points: user.points + points,
      })
      .eq("name", name);
  }

  return Response.json({ success: true });
}