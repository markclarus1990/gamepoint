import { SessionService } from "@/lib/services/SessionService";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const sessionService = new SessionService();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { user_id, station_name, payment, points, gfunds } = await req.json();

  if (!user_id || !station_name || (payment !== "points" && payment !== "gfunds")) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await sessionService.addTime({
    userId: user_id,
    stationName: station_name,
    payment,
    points,
    gfunds,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  // Log time extension as a session_start variant with add-time context
  void activityLog.logSessionStart(
    result.user.name,
    station_name,
    payment,
    payment === "gfunds" ? Number(gfunds) || 0 : 0,
    payment === "gfunds" ? Number(gfunds) || 0 : 0,
    payment === "points" ? Number(points) || 0 : 0
  );

  return Response.json(result);
}
