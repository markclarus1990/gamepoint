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
  try {
    const active = await sessionRepo.findActiveByStation(station_name);
    if (active) actorName = active.user_name;
  } catch {
    // ignore lookup errors
  }

  const result = await sessionService.endStationSession(station_name);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  if (actorName) {
    void activityLog.logSessionEnd(actorName, station_name);
  } else {
    void activityLog.logSessionEnd("unknown", station_name);
  }

  return Response.json(result);
}
