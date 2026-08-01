import { StationRepository } from "@/lib/repositories/StationRepository";

const stationRepo = new StationRepository();

export async function POST(req: Request) {
  const { ids, all, command } = await req.json();

  if (command !== "shutdown" && command !== "restart") {
    return Response.json({ error: "Invalid command" }, { status: 400 });
  }

  if (!all && (!Array.isArray(ids) || ids.length === 0)) {
    return Response.json({ error: "No stations selected" }, { status: 400 });
  }

  try {
    await stationRepo.setCommand(all ? [] : ids, command, !!all);
    return Response.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to send command";
    return Response.json({ error: message }, { status: 500 });
  }
}
