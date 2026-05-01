import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const { name, pin } = await req.json();

  if (!name || !pin) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }

  // check if user exists
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("name", name)
    .single();

  if (existing) {
    return Response.json({ error: "User already exists" }, { status: 400 });
  }

  const { error } = await supabase.from("users").insert({
    name,
    pin,
    points: 0,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}