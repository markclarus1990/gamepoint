import { supabase } from "@/lib/supabase";

export async function POST(req) {
  const { user_id, oldPin, newPin } = await req.json();

  // 1. get user
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", user_id)
    .single();

  if (!user) {
    return Response.json({ error: "User not found" });
  }

  // 2. check old PIN
  if (user.pin !== oldPin) {
    return Response.json({ error: "Incorrect old PIN" });
  }

  // 3. validate new PIN
  if (!newPin || newPin.length !== 4) {
    return Response.json({ error: "PIN must be 4 digits" });
  }

  // 4. update
  const { error } = await supabase
    .from("users")
    .update({ pin: newPin })
    .eq("id", user_id);

  if (error) {
    return Response.json({ error: error.message });
  }

  return Response.json({ success: true });
}