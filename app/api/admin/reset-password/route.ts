import bcrypt from "bcryptjs";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const SALT_ROUNDS = 10;

const userRepo = new UserRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const body = await req.json();
  // Support both test-friendly simple payload and explicit newPin
  const user_id: string | undefined = body.user_id || body.userId || body.id;
  const newPin: string | undefined = body.newPin || body.new_pin || body.pin || body.password;

  if (!user_id) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  if (newPin === undefined || newPin === null || String(newPin).trim() === "") {
    return Response.json({ error: "New PIN is required" }, { status: 400 });
  }

  const pinStr = String(newPin).trim();

  if (pinStr.length < 4 || pinStr.length > 24) {
    return Response.json({ error: "PIN must be 4-24 characters" }, { status: 400 });
  }

  const user = await userRepo.findById(user_id);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  try {
    const hashed = await bcrypt.hash(pinStr, SALT_ROUNDS);
    await userRepo.updatePin(user.id, hashed);

    // Fire-and-forget activity log; don't block response on logging failure
    try {
      await activityLog.logAdminResetPin("Admin", user.name);
    } catch {
      // ignore log failure
    }

    return Response.json({ success: true, user_id: user.id, name: user.name });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reset PIN";
    return Response.json({ error: message }, { status: 500 });
  }
}
