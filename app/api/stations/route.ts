import { randomUUID } from "crypto";
import { StationRepository } from "@/lib/repositories/StationRepository";
import { SessionService } from "@/lib/services/SessionService";

const stationRepo = new StationRepository();
const sessionService = new SessionService();

export async function GET() {
  const stations = await sessionService.getStationsWithStatus();
  return Response.json({ stations });
}

export async function POST(req: Request) {
  const { name } = await req.json();

  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Station name is required" }, { status: 400 });
  }

  const trimmed = name.trim();

  try {
    const existing = await stationRepo.findByName(trimmed);
    if (existing) {
      return Response.json({ error: "Station already exists" }, { status: 400 });
    }

    const station = await stationRepo.create(trimmed, randomUUID());
    return Response.json({ success: true, station });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create station";
    return Response.json({ error: message }, { status: 500 });
  }
}
