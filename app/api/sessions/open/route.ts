import { SessionService } from "@/lib/services/SessionService";

const sessionService = new SessionService();

export async function POST(req: Request) {
  const { station_name, minutes } = await req.json();

  if (!station_name || !minutes) {
    return Response.json({ error: "Station and minutes are required" }, { status: 400 });
  }

  const result = await sessionService.openStationSession(station_name, Number(minutes));

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
