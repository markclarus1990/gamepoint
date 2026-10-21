import { UserRepository } from "@/lib/repositories/UserRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const userRepo = new UserRepository();
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

  const before = user.time_credit_minutes ?? 0;
  const newValue = Math.max(0, before - minutes);
  await userRepo.deductTimeCreditById(user.id, minutes);

  // Log the admin deduct time action
  await activityLog.logAdminDeductTime(
    "Admin",
    name,
    minutes
  );

  return Response.json({ success: true });
}
