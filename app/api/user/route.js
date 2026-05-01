import { supabase } from "@/lib/supabase";

// GET → find user only (no auto-create)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("name", name)
    .single();

  if (!data) return Response.json({ error: "User not found" });

  return Response.json(data);
}

// POST → create user
export async function POST(req) {
  const { name, pin, email } = await req.json();

  if (!name || !pin) {
    return Response.json({ error: "Name and PIN required" });
  }

  if (pin.length !== 4) {
    return Response.json({ error: "PIN must be 4 digits" });
  }

  const { data, error } = await supabase
    .from("users")
    .insert({ name, pin, email })
    .select()
    .single();

  if (error) return Response.json({ error: "User exists" });

  return Response.json(data);
}