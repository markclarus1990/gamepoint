import { SessionService } from "@/lib/services/SessionService";
import { ActivityLogService } from "@/lib/services/ActivityLogService";
import { FundLedgerRepository } from "@/lib/repositories/FundLedgerRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";

const sessionService = new SessionService();
const activityLog = new ActivityLogService();
const fundLedger = new FundLedgerRepository();
const userRepo = new UserRepository();

export async function POST(req: Request) {
  const { user_id, station_name, payment, points, gfunds } = await req.json();

  if (!user_id || !station_name || (payment !== "points" && payment !== "gfunds" && payment !== "credit")) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Capture credit before start (for audit when payment=credit)
  let creditBefore = 0;
  try {
    const u = await userRepo.findById(user_id);
    creditBefore = u?.time_credit_minutes ?? 0;
  } catch {
    // ignore
  }

  const result = await sessionService.startSession({
    userId: user_id,
    stationName: station_name,
    payment,
    points,
    gfunds,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const minutes = result.session.minutes ?? 0;

  // Log the session start with minutes/remaining for audit
  void activityLog.logSessionStart(
    result.session.user_name,
    result.session.station_name ?? station_name,
    payment,
    Number(result.session.amount) || 0,
    result.session.gfunds_used ?? 0,
    result.session.points_used ?? 0,
    { minutes, remaining_seconds: result.remaining_seconds, credit_minutes: creditBefore }
  );

  // Distinct log when shared time is consumed (payment=credit) — links share → consumption
  if (payment === "credit" && creditBefore > 0) {
    void activityLog.logCreditConsume(
      result.session.user_name,
      result.session.station_name ?? station_name,
      creditBefore,
      result.remaining_seconds
    );
  }

  // Record gfunds spend in fund ledger for player history
  if ((result.session.gfunds_used ?? 0) > 0 && result.session.user_id) {
    const spent = result.session.gfunds_used ?? 0;
    const before = (result.user.gfunds ?? 0) + spent;
    void fundLedger.log({
      user_id: result.session.user_id,
      type: "session_payment",
      amount: -spent,
      balance_before: before,
      balance_after: result.user.gfunds ?? 0,
      description: `Session on ${result.session.station_name ?? station_name}: -₱${spent}`,
    });
  }

  return Response.json(result);
}
