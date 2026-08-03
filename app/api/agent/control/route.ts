import { StationRepository } from "@/lib/repositories/StationRepository";

const stationRepo = new StationRepository();

export async function GET(req: Request) {
  const agentKey = req.headers.get("x-agent-key");
  if (!agentKey) {
    return Response.json({ error: "Missing agent key" }, { status: 401 });
  }

  const station = await stationRepo.findByKey(agentKey);
  if (!station) {
    return Response.json({ error: "Invalid agent key" }, { status: 401 });
  }

  const rows = await stationRepo.findControlEvents(station.id);
  if (rows.length > 0) {
    await stationRepo.deleteControlEvents(rows.map((r) => r.id));
  }

  return Response.json({ events: rows.map((r) => r.payload) });
}
