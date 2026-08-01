import { StationRepository } from "@/lib/repositories/StationRepository";

const stationRepo = new StationRepository();

export async function POST(req: Request) {
  const agentKey = req.headers.get("x-agent-key");
  if (!agentKey) {
    return Response.json({ error: "Missing agent key" }, { status: 401 });
  }

  const station = await stationRepo.findByKey(agentKey);
  if (!station) {
    return Response.json({ error: "Invalid agent key" }, { status: 401 });
  }

  await stationRepo.clearCommand(station.id);

  return Response.json({ success: true });
}
