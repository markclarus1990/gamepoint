import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("redeem_requests")
      .select(`
        id,
        points_used,
        minutes,
        status,
        created_at,
        users (
          name
        )
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data || []);
  } catch (err) {
    console.error("Server crash:", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}