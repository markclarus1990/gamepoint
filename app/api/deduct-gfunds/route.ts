import { UserRepository } from "@/lib/repositories/UserRepository";
import { FundLedgerRepository } from "@/lib/repositories/FundLedgerRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const userRepo = new UserRepository();
const fundLedger = new FundLedgerRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { name, gfunds } = await req.json();

  if (!name || !gfunds || gfunds <= 0) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await userRepo.findByName(name);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const before = user.gfunds || 0;
  const newGfunds = Math.max(0, before - gfunds);
  await userRepo.updateGfundsById(user.id, newGfunds);

  void fundLedger.log({
    user_id: user.id,
    type: "admin_deduct",
    amount: -(before - newGfunds),
    balance_before: before,
    balance_after: newGfunds,
    description: `Admin deduct: -₱${before - newGfunds}`,
  });

  void activityLog.logAdminDeductGfunds("Admin", name, gfunds);

  return Response.json({ success: true });
}
