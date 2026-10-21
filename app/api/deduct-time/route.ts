import { UserRepository } from "@/lib/repositories/UserRepository";
import { SessionService } from "@/lib/services/SessionService";
import { SessionRepository } from "@/lib/repositories/SessionRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const userRepo = new UserRepository();
const sessionService = new SessionService();
const sessionRepo = new SessionRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { name, minutes } = await req.json();

  if (!name || !minutes || minutes <= 0) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await userRepo.findByName(name);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const userId = user.id;

  // Get the user's active session (authoritative remaining time)
  const activeSessionInfo = await sessionService.getActiveForUser(userId);

  let totalDeductedSeconds = 0;

  // // Case 1: Active session exists - deduct from active session remaining time
  // This is the primary balance when a user is currently playing.
  // Reducing ends_at is the convention used by startSession/addTime.
  if (activeSessionInfo.session && activeSessionInfo.remaining_seconds > 0) {
    const reductionSeconds = Math.min(
      (minutes * 60) - totalDeductedSeconds,
      activeSessionInfo.remaining_seconds
    );
    if (reductionSeconds > 0) {
      const newRemainingSeconds = activeSessionInfo.remaining_seconds - reductionSeconds;
      const newEndsAt = new Date(
        Date.now() + newRemainingSeconds * 1000
      ).toISOString();
      await sessionRepo.updateEndsAt(activeSessionInfo.session.id, newEndsAt);
      totalDeductedSeconds += reductionSeconds;
    }

    // If we've deducted the full requested amount from the active session, return
    if (totalDeductedSeconds >= minutes * 60) {
      await activityLog.logAdminDeductTime("Admin", name, minutes);
      return Response.json({
        success: true,
        deducted_minutes: minutes,
      });
    }
  }

  // Case 2: Check paused session - reduce resume_seconds so deducted time
  // cannot reappear when the session resumes.
  if (totalDeductedSeconds < minutes * 60) {
    const remainingToDeductSeconds = minutes * 60 - totalDeductedSeconds;

    const pausedSession = await sessionRepo.findPausedForUser(userId);

    if (pausedSession && pausedSession.resume_seconds) {
      const reductionSeconds = Math.min(
        remainingToDeductSeconds,
        pausedSession.resume_seconds as number
      );
      const newResumeSeconds = pausedSession.resume_seconds as number - reductionSeconds;

      await sessionRepo.updateResumeSeconds(pausedSession.id, newResumeSeconds);
      totalDeductedSeconds += reductionSeconds;
    }
  }

  // Case 3: No active session and no paused session (or their balances were exhausted).
  // Deduct from the user's time credit minutes according to existing business rules.
  if (totalDeductedSeconds < minutes * 60) {
    const remainingToDeductSeconds = minutes * 60 - totalDeductedSeconds;
    const beforeCredit = user.time_credit_minutes ?? 0;
    const actualDeductedSeconds = Math.min(beforeCredit * 60, remainingToDeductSeconds);

    if (actualDeductedSeconds > 0) {
      const actualDeductedMinutes = Math.floor(actualDeductedSeconds / 60);
      await userRepo.deductTimeCreditById(userId, actualDeductedMinutes);
      totalDeductedSeconds += actualDeductedSeconds;
    }
  }

  // Log the admin deduct time action with the actual amount deducted
  await activityLog.logAdminDeductTime("Admin", name, Math.floor(totalDeductedSeconds / 60));

  return Response.json({
    success: true,
    deducted_minutes: Math.floor(totalDeductedSeconds / 60),
    remaining_minutes: minutes - Math.floor(totalDeductedSeconds / 60),
  });
}