import { SessionService } from "@/lib/services/SessionService";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const sessionService = new SessionService();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { station_name, minutes } = await req.json();

  if (!station_name || !minutes) {
    return Response.json({ error: "Station and minutes are required" }, { status: 400 });
  }

  const mins = Number(minutes);
  const result = await sessionService.openStationSession(station_name, mins);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  // Log admin opening time on station (walk-in = cash, no stored peso amount)
  void activityLog.logAdminOpenTime("Admin", station_name, result.session.minutes ?? mins, 0);

  return Response.json(result);
}
