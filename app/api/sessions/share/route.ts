import { SessionService } from "@/lib/services/SessionService";

const sessionService = new SessionService();

export async function POST(req: Request) {
  const { source_station, source_user_id, target_name, minutes } =
    await req.json();

  if (typeof target_name !== "string" || !target_name.trim()) {
    return Response.json({ error: "Target player name is required" }, { status: 400 });
  }

  const result = await sessionService.shareTime({
    sourceStation: source_station,
    sourceUserId: source_user_id,
    targetName: target_name.trim(),
    minutes,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
