import { SessionService } from "@/lib/services/SessionService";
import { SessionRepository } from "@/lib/repositories/SessionRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const sessionService = new SessionService();
const sessionRepo = new SessionRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { station_name } = await req.json();

  if (!station_name) {
    return Response.json({ error: "Station name is required" }, { status: 400 });
  }

  // Capture who was playing BEFORE ending (needed for audit log)
  let actorName: string | null = null;
  let activeSession: Awaited<ReturnType<typeof sessionRepo.findActiveByStation>> | null = null;
  try {
    activeSession = await sessionRepo.findActiveByStation(station_name);
    if (activeSession) actorName = activeSession.user_name;
  } catch {
    // ignore lookup errors
  }

  const result = await sessionService.endStationSession(station_name);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  // Ended status: include duration + remaining time before end
  const endedAt = new Date().toISOString();
  if (activeSession) {
    const remaining = (() => {
      try {
        const endsAt = activeSession.ends_at ? new Date(activeSession.ends_at).getTime() : Date.now();
        return Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      } catch {
        return undefined;
      }
    })();
    void activityLog.logSessionEnd(actorName || activeSession.user_name, station_name, {
      status: "Ended",
      remaining_seconds: remaining,
      duration_minutes: activeSession.minutes,
      ended_at: endedAt,
      session_id: activeSession.id,
      reason: "admin_end",
    });
  } else if (actorName) {
    void activityLog.logSessionEnd(actorName, station_name, { status: "Ended", ended_at: endedAt, reason: "admin_end" });
  } else {
    void activityLog.logSessionEnd("unknown", station_name, { status: "Ended", ended_at: endedAt, reason: "admin_end" });
  }

  return Response.json(result);
}
