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

  const gfundsUsed = payment === "gfunds" ? Number(gfunds) || 0 : 0;
  const pointsUsed = payment === "points" ? Number(points) || 0 : 0;
  const minutesAdded = payment === "gfunds" ? gfundsUsed * 4 : pointsUsed ? (pointsUsed / 20) * 8 : 0;

  void activityLog.logAddTime(result.user.name, station_name, payment, minutesAdded, {
    gfundsUsed,
    pointsUsed,
    remaining_seconds: result.remaining_seconds,
  });

  return Response.json(result);
}
