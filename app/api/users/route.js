import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("points", { ascending: false });

  if (error) {
    return Response.json({ error: error.message });
  }

  return Response.json(data);
}