import { SessionService } from "@/lib/services/SessionService";

const sessionService = new SessionService();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "User ID is required" });
  }

  const result = await sessionService.getFullUserHistory(id);

  if ("error" in result) {
    return Response.json({ error: result.error });
  }

  return Response.json(result);
}
