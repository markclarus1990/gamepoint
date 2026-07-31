import { SessionService } from "@/lib/services/SessionService";

const sessionService = new SessionService();

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

  const result = await sessionService.resumeSession(user_id, station_name);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
