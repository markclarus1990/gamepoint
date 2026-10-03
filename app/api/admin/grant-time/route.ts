import { SessionService } from "@/lib/services/SessionService";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const sessionService = new SessionService();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { user_id, target_name, minutes } = await req.json();

  const mins = Number(minutes);
  if ((!user_id && (typeof target_name !== "string" || !target_name.trim())) || !Number.isInteger(mins) || mins <= 0) {
    return Response.json({ error: "Player and positive whole minutes are required" }, { status: 400 });
  }

  const result = await sessionService.grantTime({
    userId: user_id,
    targetName: typeof target_name === "string" ? target_name.trim() : undefined,
    minutes: mins,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  void activityLog.logAdminGrantTime("Admin", result.player_name, mins, {
    target_station: result.target_station,
    target_session_seconds: result.target_session_seconds,
    target_credit: result.target_credit,
  });

  return Response.json(result);
}
