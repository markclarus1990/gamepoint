import { RedeemService } from "@/lib/services/RedeemService";
import { RedeemRepository } from "@/lib/repositories/RedeemRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const redeemService = new RedeemService();
const redeemRepo = new RedeemRepository();
const userRepo = new UserRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { request_id } = await req.json();

  if (!request_id) {
    return Response.json({ error: "request_id is required" }, { status: 400 });
  }

  // Capture details BEFORE approving (approve() only returns { success })
  let userName = "unknown";
  let pointsUsed = 0;
  let minutes = 0;
  try {
    const r = await redeemRepo.findById(request_id);
    if (r) {
      pointsUsed = r.points_used;
      minutes = r.minutes;
      const u = await userRepo.findById(r.user_id);
      if (u?.name) userName = u.name;
    }
  } catch {
    // ignore
  }

  const result = await redeemService.approve(request_id);

  if ("error" in result) {
    return Response.json({ error: result.error });
  }

  void activityLog.logRedeemApprove("Admin", userName, pointsUsed, minutes);

  return Response.json({ success: true });
}
