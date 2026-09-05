import { SessionService } from "@/lib/services/SessionService";
import { SessionRepository } from "@/lib/repositories/SessionRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const sessionService = new SessionService();
const sessionRepo = new SessionRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { source_station, source_user_id, target_name, minutes } =
    await req.json();

  if (typeof target_name !== "string" || !target_name.trim()) {
    return Response.json({ error: "Target player name is required" }, { status: 400 });
  }

  // Capture giver name BEFORE sharing (critical for abuse investigation)
  let giverName = "unknown";
  try {
    const active = source_station
      ? await sessionRepo.findActiveByStation(source_station)
      : source_user_id
        ? await sessionRepo.findActiveForUser(source_user_id)
        : null;
    if (active?.user_name) giverName = active.user_name;
  } catch {
    // ignore
  }

  const mins = Number(minutes);
  const result = await sessionService.shareTime({
    sourceStation: source_station,
    sourceUserId: source_user_id,
    targetName: target_name.trim(),
    minutes: mins,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  void activityLog.logSessionShare(
    giverName,
    target_name.trim(),
    mins,
    source_station ?? ""
  );

  return Response.json(result);
}
