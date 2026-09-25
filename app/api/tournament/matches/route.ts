import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { matchId, date, winner, round, conference } = body;

    if (!matchId || !date) {
      return Response.json({ error: "matchId and date are required" }, { status: 400 });
    }

    // Winners are admin-controlled with auto-advancement — use /api/admin/tournament/set-winner.
    // This public route only schedules dates (no winner) to prevent unauthorized bracket changes.
    if (winner) {
      return Response.json(
        { error: "Setting winners is admin-only — use /api/admin/tournament/set-winner" },
        { status: 403 }
      );
    }

    const upsertPayload: Record<string, unknown> = {
      match_id: matchId,
      tournament_type: "nba",
      scheduled_date: date,
      status: "scheduled",
    };
    if (round) upsertPayload.round = round;
    if (conference) upsertPayload.conference = conference;

    const { error } = await supabase.from("tournament_matches").upsert(upsertPayload as unknown as Record<string, unknown>, {
      onConflict: "match_id",
      ignoreDuplicates: false,
    });

    if (error) {
      // fallback before migration (missing columns)
      const fallback = await supabase.from("tournament_matches").upsert(
        {
          match_id: matchId,
          scheduled_date: date,
          status: "scheduled",
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

    const list = matches || [];
    // Player names for bracket display (team owners + winners)
    let users: Record<string, string> = {};
    try {
      const ids = Array.from(
        new Set(
          list.flatMap((m: { team1_user_id?: string | null; team2_user_id?: string | null; winner_user_id?: string | null }) => [
            m.team1_user_id,
            m.team2_user_id,
            m.winner_user_id,
          ]).filter(Boolean) as string[]
        )
      );
      if (ids.length > 0) {
        const { data: udata } = await supabase.from("users").select("id, name").in("id", ids);
        users = Object.fromEntries(((udata as { id: string; name: string }[]) || []).map((u) => [u.id, u.name]));
      }
    } catch {}

    return Response.json({ matches: list, users });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as { message: string }).message) : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

