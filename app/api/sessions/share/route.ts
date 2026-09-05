import { SessionService } from "@/lib/services/SessionService";
import { SessionRepository } from "@/lib/repositories/SessionRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const sessionService = new SessionService();
const sessionRepo = new SessionRepository();
const userRepo = new UserRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { source_station, source_user_id, target_name, minutes } =
    await req.json();

  if (typeof target_name !== "string" || !target_name.trim()) {
    return Response.json({ error: "Target player name is required" }, { status: 400 });
  }

  // Capture giver + forensic enrichment BEFORE sharing
  let giverName = "unknown";
  let giverRemainingBefore: number | undefined;
  let targetCreditBefore: number | undefined;
  let targetStationBefore: string | null | undefined;
  try {
    const active = source_station
      ? await sessionRepo.findActiveByStation(source_station)
      : source_user_id
        ? await sessionRepo.findActiveForUser(source_user_id)
        : null;
    if (active?.user_name) giverName = active.user_name;
    if (active?.ends_at) {
      giverRemainingBefore = Math.max(0, Math.floor((new Date(active.ends_at).getTime() - Date.now()) / 1000));
    }
  } catch {
    // ignore
  }

  // Capture target credit + station BEFORE sharing (to show where time went)
  try {
    const targetUser = await userRepo.findByName(target_name.trim(), true);
    if (targetUser) {
      targetCreditBefore = targetUser.time_credit_minutes ?? 0;
      const targetActive = await sessionRepo.findActiveForUser(targetUser.id);
      targetStationBefore = targetActive?.station_name ?? null;
    }
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
    void activityLog.logSessionShareFailed(
      giverName,
      target_name.trim(),
      mins,
      source_station ?? "",
      result.error
    );
    return Response.json({ error: result.error }, { status: 400 });
  }

  void activityLog.logSessionShare(giverName, target_name.trim(), mins, source_station ?? "", {
    target_station: result.target_station,
    giver_remaining_before: giverRemainingBefore,
    target_credit_before: targetCreditBefore,
    target_station_before: targetStationBefore ?? undefined,
  });

  return Response.json(result);
}
