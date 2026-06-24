import { SessionService } from "@/lib/services/SessionService";

const sessionService = new SessionService();

export async function POST(req: Request) {
  const { name, amount, minutes, points } = await req.json();

  await sessionService.addSession(name, amount, minutes, points);

  return Response.json({ success: true });
}
