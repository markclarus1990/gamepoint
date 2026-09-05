import { ActivityLogRepository } from "@/lib/repositories/ActivityLogRepository";
import { FundLedgerRepository } from "@/lib/repositories/FundLedgerRepository";
import { LedgerRepository } from "@/lib/repositories/LedgerRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { RedeemRepository } from "@/lib/repositories/RedeemRepository";
import { SessionRepository } from "@/lib/repositories/SessionRepository";

const activityLogRepo = new ActivityLogRepository();
const fundLedgerRepo = new FundLedgerRepository();
const pointLedgerRepo = new LedgerRepository();
const userRepo = new UserRepository();
const redeemRepo = new RedeemRepository();
const sessionRepo = new SessionRepository();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("user_id");

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  const user = await userRepo.findById(userId);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const [pointLedger, fundLedger, sessions, redeems, activityLogs] =
    await Promise.all([
      pointLedgerRepo.findByUser(userId).catch(() => ({ data: [], total: 0 })),
      fundLedgerRepo.findByUser(userId).catch(() => ({ data: [], total: 0 })),
      sessionRepo.findByUserId(userId).catch(() => []),
      redeemRepo.findByUserId(userId).catch(() => []),
      // Bidirectional: events the player caused AND events done to them
      // (received shares, admin loads/deducts)
      activityLogRepo.getByUser(user.name, 200).catch(() => []),
    ]);

  const totalPointsEarned = (pointLedger.data || [])
    .filter((e) => e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalPointsSpent = (pointLedger.data || [])
    .filter((e) => e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const totalGFundsLoaded = (fundLedger.data || [])
    .filter((e) => e.type === "admin_load")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalGFundsDeducted = (fundLedger.data || [])
    .filter((e) => e.type === "admin_deduct")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const totalSessionMinutes = (sessions || []).reduce(
    (sum, s) => sum + (s.minutes || 0),
    0
  );

  // Unified chronological timeline across all sources
  const timeline = [
    ...((activityLogs || []) as unknown[]).map((e) => ({
      source: "activity" as const,
      entry: e,
      created_at: (e as { created_at?: string }).created_at ?? "",
    })),
    ...((pointLedger.data || []) as unknown[]).map((e) => ({
      source: "point_ledger" as const,
      entry: e,
      created_at: (e as { created_at?: string }).created_at ?? "",
    })),
    ...((fundLedger.data || []) as unknown[]).map((e) => ({
      source: "fund_ledger" as const,
      entry: e,
      created_at: (e as { created_at?: string }).created_at ?? "",
    })),
    ...((sessions || []) as unknown[]).map((e) => ({
      source: "session" as const,
      entry: e,
      created_at: (e as { created_at?: string }).created_at ?? "",
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      points: user.points,
      gfunds: user.gfunds,
    },
    timeline,
    point_ledger: {
      data: pointLedger.data || [],
      total: pointLedger.total,
    },
    fund_ledger: {
      data: fundLedger.data || [],
      total: fundLedger.total,
    },
    sessions: {
      data: sessions || [],
      totalMinutes: totalSessionMinutes,
    },
    redeems: {
      data: redeems || [],
      total: (redeems || []).length,
    },
    activity_log: {
      data: activityLogs || [],
    },
    summary: {
      total_points_earned: totalPointsEarned,
      total_points_spent: totalPointsSpent,
      total_gfunds_loaded: totalGFundsLoaded,
      total_gfunds_deducted: totalGFundsDeducted,
      total_session_minutes: totalSessionMinutes,
    },
  });
}
