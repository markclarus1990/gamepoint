import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { matchId, date, winner, loser, winner_user_id, round, conference } = body;

    if (!matchId || !date) {
      return Response.json({ error: "matchId and date are required" }, { status: 400 });
    }

    // Validate winner is participant if provided — fetch match if exists
    if (winner) {
      try {
        const { data: existing } = await supabase.from("tournament_matches").select("team1, team2").eq("match_id", matchId).maybeSingle();
        if (existing && existing.team1 && existing.team2) {
          if (winner !== existing.team1 && winner !== existing.team2) {
            return Response.json({ error: "winner must be one of the two teams in this match" }, { status: 400 });
          }
        }
      } catch {}
    }

    const upsertPayload: Record<string, unknown> = {
      match_id: matchId,
      tournament_type: "nba",
      scheduled_date: date,
      winner: winner || null,
      loser: loser || null,
      winner_user_id: winner_user_id || null,
      status: winner ? "completed" : "scheduled",
    };
    if (round) upsertPayload.round = round;
    if (conference) upsertPayload.conference = conference;

    const { error } = await supabase.from("tournament_matches").upsert(upsertPayload as unknown as Record<string, unknown>, {
      onConflict: "match_id",
    });

    if (error) {
      // fallback before migration (missing columns)
      const fallback = await supabase.from("tournament_matches").upsert(
        {
          match_id: matchId,
          scheduled_date: date,
          winner,
          loser,
          status: winner ? "completed" : "scheduled",
        } as unknown as Record<string, unknown>,
        { onConflict: "match_id" }
      );
      if (fallback.error) return Response.json({ error: fallback.error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: string }).message) : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const round = searchParams.get("round") || "all";

    let query = supabase.from("tournament_matches").select("*").eq("tournament_type", "nba");

    // fallback if column missing
    try {
      // test column exists by dummy filter
      await supabase.from("tournament_matches").select("tournament_type").limit(1);
    } catch {
      query = supabase.from("tournament_matches").select("*") as unknown as typeof query;
    }

    if (round !== "all") {
      query = query.eq("round", round);
    }

    const { data: matches, error } = await query.order("created_at", { ascending: true });
    if (error) {
      // fallback without tournament_type filter
      let q2 = supabase.from("tournament_matches").select("*");
      if (round !== "all") q2 = q2.eq("round", round);
      const { data: m2 } = await q2.order("created_at", { ascending: true });
      return Response.json({ matches: m2 || [] });
    }

    return Response.json({ matches: matches || [] });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: string }).message) : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

