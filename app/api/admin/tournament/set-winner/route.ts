import { supabase } from "@/lib/supabase";
import { advanceBracket, resetMatchAndDownstream } from "@/lib/tournament/nba-advance";
import { ActivityLogRepository } from "@/lib/repositories/ActivityLogRepository";

const activityLog = new ActivityLogRepository();

async function verifyAdmin(adminId: unknown): Promise<boolean> {
  // Frontend gates via localStorage.isAdmin; server verifies when admin_id supplied.
  // Keep permissive when absent to match existing admin API patterns (e.g. /api/admin/load).
  if (!adminId || typeof adminId !== "string") return true;
  try {
    const { data } = await supabase.from("users").select("is_admin").eq("id", adminId).maybeSingle();
    if (data && (data as { is_admin?: boolean }).is_admin === false) return false;
    return true;
  } catch {
    return true;
  }
}

// GET /api/admin/tournament/set-winner?round=all — admin list view (all rounds, ordered)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const round = searchParams.get("round") || "all";
    let query = supabase
      .from("tournament_matches")
      .select("*")
      .eq("tournament_type", "nba");
    if (round !== "all") query = query.eq("round", round);
    const { data, error } = await query.order("created_at", { ascending: true });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const matches = data || [];
    const completed = matches.filter((m: { status?: string }) => m.status === "completed").length;
    const championRow = matches.find((m: { match_id?: string }) => m.match_id === "nba-r4-final");
    const champion =
      championRow?.status === "completed" ? (championRow as { winner?: string }).winner ?? null : null;
    // Player names: join users for team/winner user_ids (one query)
    let users: Record<string, string> = {};
    try {
      const ids = Array.from(
        new Set(
          matches.flatMap((m: { team1_user_id?: string | null; team2_user_id?: string | null; winner_user_id?: string | null }) => [
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
    const championUserId = (championRow as { winner_user_id?: string | null } | undefined)?.winner_user_id ?? null;
    const championName = championUserId && users[championUserId] ? users[championUserId] : null;
    return Response.json({ matches, completed, total: matches.length, champion, championName, users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}

// POST /api/admin/tournament/set-winner
// { match_id, winner } → set winner (completed) + auto-advance
// { match_id, action: "reset" } → clear winner (scheduled) + clean downstream
// { action: "reset_all" } → clear ALL winners, delete later rounds, First Round back to scheduled
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { match_id, matchId, winner, action, admin_id, adminId, scheduled_date } = body;
    const id: string | undefined = match_id || matchId;

    const ok = await verifyAdmin(admin_id ?? adminId);
    if (!ok) {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    const actor = (admin_id ?? adminId ?? "Admin") as string;

    // ---- RESET ALL (results-only: players + First Round pairings untouched) ----
    if (action === "reset_all") {
      const { error: delErr, count: deletedCount } = await supabase
        .from("tournament_matches")
        .delete({ count: "exact" })
        .eq("tournament_type", "nba")
        .in("round", ["Semifinals", "Conference Finals", "Finals"]);
      if (delErr) return Response.json({ error: delErr.message }, { status: 500 });

      const { error: clearErr, count: resetCount } = await supabase
        .from("tournament_matches")
        .update(
          { winner: null, winner_user_id: null, loser: null, status: "scheduled" },
          { count: "exact" }
        )
        .eq("tournament_type", "nba")
        .eq("round", "First Round");
      if (clearErr) return Response.json({ error: clearErr.message }, { status: 500 });

      void activityLog.log({
        actor_id: typeof actor === "string" && actor.length > 20 ? actor : null,
        actor_name: "Admin",
        actor_role: "admin",
        action: "tournament_reset_all",
        target_type: "tournament",
        target_id: "nba",
        details: { clearedDownstream: deletedCount ?? 0, resetFirstRound: resetCount ?? 0 },
      });
      return Response.json({
        success: true,
        resetAll: true,
        clearedDownstream: deletedCount ?? 0,
        resetFirstRound: resetCount ?? 0,
      });
    }

    if (!id) {
      return Response.json({ error: "match_id is required" }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("tournament_matches")
      .select("*")
      .eq("match_id", id)
      .maybeSingle();
    if (fetchErr) return Response.json({ error: fetchErr.message }, { status: 500 });
    if (!existing) {
      return Response.json(
        { error: `Match ${id} not found — it is created automatically once its source games complete` },
        { status: 404 }
      );
    }
    const m = existing as {
      team1: string | null;
      team2: string | null;
      team1_user_id: string | null;
      team2_user_id: string | null;
      winner: string | null;
    };

    // ---- RESET ----
    if (action === "reset" || winner === null) {
      const { error: resetErr } = await supabase
        .from("tournament_matches")
        .update({ winner: null, winner_user_id: null, loser: null, status: "scheduled" })
        .eq("match_id", id);
      if (resetErr) return Response.json({ error: resetErr.message }, { status: 500 });

      const { deletedStale, updatedDownstream } = await resetMatchAndDownstream(supabase, id);
      void activityLog.log({
        actor_id: typeof actor === "string" && actor.length > 20 ? actor : null,
        actor_name: "Admin",
        actor_role: "admin",
        action: "tournament_reset",
        target_type: "tournament_match",
        target_id: id,
        details: { deletedStale, updatedDownstream },
      });
      return Response.json({ success: true, reset: true, deletedStale, updatedDownstream });
    }

    // ---- SET WINNER ----
    if (!winner || typeof winner !== "string") {
      return Response.json({ error: "winner is required (or action: reset)" }, { status: 400 });
    }
    if (winner !== m.team1 && winner !== m.team2) {
      return Response.json({ error: "winner must be one of the two teams in this match" }, { status: 400 });
    }

    const isTeam1 = winner === m.team1;
    const loser = isTeam1 ? m.team2 : m.team1;
    const winner_user_id = isTeam1 ? m.team1_user_id : m.team2_user_id;

    const updatePayload: Record<string, unknown> = {
      winner,
      loser,
      winner_user_id: winner_user_id ?? null,
      status: "completed",
    };
    if (scheduled_date) updatePayload.scheduled_date = scheduled_date;

    const { error: updateErr } = await supabase
      .from("tournament_matches")
      .update(updatePayload)
      .eq("match_id", id);
    if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 });

    const { createdNext, deletedStale } = await advanceBracket(supabase, id);

    void activityLog.log({
      actor_id: typeof actor === "string" && actor.length > 20 ? actor : null,
      actor_name: "Admin",
      actor_role: "admin",
      action: "tournament_set_winner",
      target_type: "tournament_match",
      target_id: id,
      details: { winner, loser, createdNext, deletedStale },
    });

    const champion = id === "nba-r4-final" ? winner : null;

    return Response.json({ success: true, match_id: id, winner, loser, createdNext, deletedStale, champion });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
