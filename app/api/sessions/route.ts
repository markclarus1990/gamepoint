import { SessionService } from "@/lib/services/SessionService";

const sessionService = new SessionService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ user: null, history: [] });
  }

  const result = await sessionService.getUserSessionHistory(id);
  return Response.json(result);
}
