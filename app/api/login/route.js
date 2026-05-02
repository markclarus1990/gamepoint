import { supabase } from "@/lib/supabase";

export async function POST(req) {
  const { name, pin } = await req.json();

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .ilike("name", name) // ✅ case-insensitive
    .single();

  if (error || !user) {
    return Response.json({ error: "User not found" });
  }

  if (user.pin !== pin) {
    return Response.json({ error: "Invalid PIN" });
  }

  // ✅ return only what frontend needs
  return Response.json({
    id: user.id,
    name: user.name,
    avatar_url: user.avatar_url,
  });
}