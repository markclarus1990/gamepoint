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

  // Deduct from time credit
  const before = user.time_credit_minutes ?? 0;
  const newCredit = Math.max(0, before - minutes);
  await userRepo.deductTimeCreditById(user.id, minutes);

  // Also deduct from active session remaining time
  // Find the user's active sessions by checking session history
  const userSessions = await sessionService.getUserSessionHistory(user.id);
  
  // Iterate through sessions and logout any active ones
  if (userSessions && userSessions.history) {
    for (const s of userSessions.history) {
      // Check if session is active (not ended, not paid)
      if (s.status && !s.status.toLowerCase().includes("ended") && s.station_name) {
        try {
          await sessionService.logoutStationSession(s.station_name as string);
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }

  // Log the admin deduct time action
  await activityLog.logAdminDeductTime(
    "Admin",
    name,
    minutes
  );

  return Response.json({ success: true });
}