import { SessionService } from "@/lib/services/SessionService";

const sessionService = new SessionService();

export async function POST(req: Request) {
  const { user_id, station_name, payment, points, gfunds } = await req.json();

  if (!user_id || !station_name || (payment !== "points" && payment !== "gfunds" && payment !== "credit")) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await sessionService.startSession({
    userId: user_id,
    stationName: station_name,
    payment,
    points,
    gfunds,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json(result);
}
