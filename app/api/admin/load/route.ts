import { UserRepository } from "@/lib/repositories/UserRepository";
import { FundLedgerRepository } from "@/lib/repositories/FundLedgerRepository";
import { LedgerRepository } from "@/lib/repositories/LedgerRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const userRepo = new UserRepository();
const fundLedger = new FundLedgerRepository();
const pointLedger = new LedgerRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { user_id, gfunds, points } = await req.json();

  if (!user_id) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  const g = Number(gfunds) || 0;
  const p = Number(points) || 0;

  if (g < 0 || p < 0 || !Number.isInteger(g) || !Number.isInteger(p)) {
    return Response.json({ error: "Invalid amount" }, { status: 400 });
  }

  if (g <= 0 && p <= 0) {
    return Response.json({ error: "Enter a gfunds or points amount" }, { status: 400 });
  }

  const user = await userRepo.findById(user_id);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const beforeGfunds = user.gfunds || 0;

  try {
    if (g > 0) {
      await userRepo.updateGfundsById(user.id, beforeGfunds + g);
      // Record in fund ledger so admin can see where funds came from
      void fundLedger.log({
        user_id: user.id,
        type: "admin_load",
        amount: g,
        balance_before: beforeGfunds,
        balance_after: beforeGfunds + g,
        description: `Admin load: +₱${g}`,
      });
    }
    if (p > 0) {
      const beforePoints = user.points || 0;
      await userRepo.updatePointsById(user.id, beforePoints + p);
      // Record in point ledger so admin can see where points came from
      void pointLedger.log({
        user_id: user.id,
        type: "admin_adjustment",
        amount: p,
        balance_before: beforePoints,
        balance_after: beforePoints + p,
        description: `Admin load: +${p} pts`,
      });
    }

    void activityLog.logAdminLoad("Admin", user.name, g, p);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load account";
    return Response.json({ error: message }, { status: 500 });
  }

  const updated = await userRepo.findById(user.id);
  return Response.json({ success: true, user: updated });
}
