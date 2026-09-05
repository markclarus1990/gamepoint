import { ActivityLogRepository } from "@/lib/repositories/ActivityLogRepository";

const activityLogRepo = new ActivityLogRepository();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const fromDate = searchParams.get("from");
  const toDate = searchParams.get("to");
  const actor = searchParams.get("actor");
  const action = searchParams.get("action");
  const search = searchParams.get("search");
  const page = Number(searchParams.get("page") || "1");
  const pageSize = Number(searchParams.get("pageSize") || "50");

  const filters = {
    fromDate,
    toDate,
    actor,
    action,
    search,
    page,
    pageSize,
  };

  try {
    const result = await activityLogRepo.findAll(filters);
    return Response.json(result);
  } catch (err: unknown) {
    // Table may not exist yet if migration hasn't been applied
    const message = err instanceof Error ? err.message : "Failed to load activity log";
    return Response.json({ data: [], total: 0, page, pageSize, error: message });
  }
}