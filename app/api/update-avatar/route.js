import { supabase } from "@/lib/supabase";

export async function POST(req) {
  const { name, avatar_url } = await req.json();

  const { error } = await supabase
    .from("users")
    .update({ avatar_url })
    .eq("name", name);

  if (error) {
    return Response.json({ error: error.message });
  }

  return Response.json({ success: true });
}