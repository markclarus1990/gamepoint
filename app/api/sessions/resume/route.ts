import { SessionService } from "@/lib/services/SessionService";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const sessionService = new SessionService();
const userRepo = new UserRepository();
const activityLog = new ActivityLogService();

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("user_id");

  if (!userId) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  const resumeSeconds = await sessionService.getResumeSeconds(userId);
  return Response.json({ resume_seconds: resumeSeconds });
}

export async function POST(req: Request) {
  const { user_id, station_name } = await req.json();

  if (!user_id || !station_name) {
    return Response.json({ error: "user_id and station_name are required" }, { status: 400 });
  }

  const agentKey = req.headers.get("x-agent-key");
  const result = await sessionService.resumeSession(user_id, station_name, agentKey);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  let actorName = "unknown";
  try {
    const u = await userRepo.findById(user_id);
    if (u?.name) actorName = u.name;
  } catch {
    // ignore
  }

  void activityLog.logSessionResume(actorName, station_name);

  return Response.json(result);
}
