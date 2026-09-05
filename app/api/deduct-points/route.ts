import { UserRepository } from "@/lib/repositories/UserRepository";
import { LedgerRepository } from "@/lib/repositories/LedgerRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const userRepo = new UserRepository();
const pointLedger = new LedgerRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { name, points } = await req.json();

  if (!name || !points || points <= 0) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await userRepo.findByName(name);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const beforePoints = user.points || 0;
  const actualDeducted = Math.min(points, beforePoints);
  const newPoints = Math.max(0, beforePoints - points);
  await userRepo.updatePointsByName(name, newPoints);

  // Record in point ledger so admin can see where points went
  void pointLedger.log({
    user_id: user.id,
    type: "admin_adjustment",
    amount: -actualDeducted,
    balance_before: beforePoints,
    balance_after: newPoints,
    description: `Admin deduct: -${actualDeducted} pts`,
  });

  // Log the admin deduct points action
  await activityLog.logAdminDeductPoints(
    "Admin", // actor - the admin user (we could get this from session)
    name,
    points
  );

  return Response.json({ success: true });
}
