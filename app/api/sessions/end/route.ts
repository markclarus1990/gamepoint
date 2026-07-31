import { SessionService } from "@/lib/services/SessionService";

const sessionService = new SessionService();

export async function POST(req: Request) {
  const { station_name } = await req.json();

  if (!station_name) {
    return Response.json({ error: "Station name is required" }, { status: 400 });
  }

  const result = await sessionService.endStationSession(station_name);

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
