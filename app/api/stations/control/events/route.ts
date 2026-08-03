import { StationRepository } from "@/lib/repositories/StationRepository";

const stationRepo = new StationRepository();
const EVENT_TYPES = ["click", "drag", "scroll", "key", "text"];

export async function POST(req: Request) {
  const { stationId, event } = await req.json();

  if (!stationId || !event || typeof event !== "object" || Array.isArray(event)) {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }
  if (!EVENT_TYPES.includes(event.type)) {
    return Response.json({ error: "Invalid event type" }, { status: 400 });
  }

  try {
    await stationRepo.insertControlEvent(stationId, event);
    return Response.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to send control event";
    return Response.json({ error: message }, { status: 500 });
  }
}
