import { AuthService } from "@/lib/services/AuthService";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const authService = new AuthService();
const userRepo = new UserRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { user_id, oldPin, newPin } = await req.json();

  const result = await authService.changePassword(user_id, oldPin, newPin);

  if ("error" in result) {
    return Response.json({ error: result.error });
  }

  try {
    const u = await userRepo.findById(user_id);
    if (u?.name) void activityLog.logPinChange(u.name);
  } catch {
    // ignore
  }

  return Response.json({ success: true });
}
