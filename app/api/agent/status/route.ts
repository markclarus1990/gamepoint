import { SessionService } from "@/lib/services/SessionService";

const sessionService = new SessionService();

export async function GET(req: Request) {
  const agentKey = req.headers.get("x-agent-key");

  if (!agentKey) {
    return Response.json({ error: "Missing agent key" }, { status: 401 });
  }

  const result = await sessionService.getAgentStatus(agentKey);

  if ("error" in result) {
    return Response.json(result, { status: 401 });
  }

  return Response.json(result);
}
