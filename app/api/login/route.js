import { supabase } from "@/lib/supabase";

export async function POST(req) {
  const { name, pin } = await req.json();

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("name", name)
    .single();

  if (!user || user.pin !== pin) {
    return Response.json({ error: "Invalid credentials" });
  }

  return Response.json(user);
}