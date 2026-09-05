import { ActivityLogRepository } from "@/lib/repositories/ActivityLogRepository";

const activityLogRepo = new ActivityLogRepository();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit")) || 10));

  try {
    const top = await activityLogRepo.getTopSharers(from, to, limit);
    return Response.json({ top_sharers: top });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load top sharers";
    return Response.json({ error: message }, { status: 500 });
  }
}
