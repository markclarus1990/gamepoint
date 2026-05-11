import { supabase } from "@/lib/supabase";

export async function GET() {

  const { data, error } = await supabase
    .from("users")
    .select("id, name, points, avatar_url")
    .order("points", { ascending: false })
    .limit(10);

  if (error) {
    return Response.json([]);
  }

  return Response.json(data || []);
}