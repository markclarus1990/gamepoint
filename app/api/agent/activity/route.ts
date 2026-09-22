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

  const { window_title, process_name } = await req.json();
  const cleanTitle =
    typeof window_title === "string" && window_title.trim()
      ? window_title.trim().slice(0, 200)
      : null;
  const cleanProcess =
    typeof process_name === "string" && process_name.trim()
      ? process_name.trim().slice(0, 120)
      : null;

  if (!cleanTitle && !cleanProcess) {
    return Response.json({ error: "Missing activity" }, { status: 400 });
  }

  await stationRepo.saveActivity(station.id, cleanTitle, cleanProcess);

  return Response.json({ success: true });
}
