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

  let actorName = "unknown";
  try {
    const active = await sessionRepo.findActiveByStation(station_name);
    if (active?.user_name) actorName = active.user_name;
  } catch {
    // ignore
  }

  const agentKey = req.headers.get("x-agent-key");
  const result = await sessionService.logoutStationSession(station_name, agentKey);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  void activityLog.logSessionLogout(actorName, station_name, {
    remaining_seconds: result.remaining_seconds,
    was_paused: result.remaining_seconds > 0,
  });

  return Response.json(result);
}
