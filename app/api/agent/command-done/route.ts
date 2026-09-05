import { StationRepository } from "@/lib/repositories/StationRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const stationRepo = new StationRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const agentKey = req.headers.get("x-agent-key");
  if (!agentKey) {
    return Response.json({ error: "Missing agent key" }, { status: 401 });
  }

  const station = await stationRepo.findByKey(agentKey);
  if (!station) {
    return Response.json({ error: "Invalid agent key" }, { status: 401 });
  }

  const command = station.command ?? "unknown";
  await stationRepo.clearCommand(station.id);

  void activityLog.logAgentCommandDone(station.name, command);

  return Response.json({ success: true });
}
