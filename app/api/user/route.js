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
  const { name } = await req.json();

  if (!name) return Response.json({ error: "Name required" });

  const { data, error } = await supabase
    .from("users")
    .insert({ name })
    .select()
    .single();

  if (error) return Response.json({ error: "User exists or error" });

  return Response.json(data);
}