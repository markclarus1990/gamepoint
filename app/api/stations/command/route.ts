import { StationRepository } from "@/lib/repositories/StationRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const stationRepo = new StationRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { ids, all, command } = await req.json();

  if (command !== "shutdown" && command !== "restart" && command !== "screenshot") {
    return Response.json({ error: "Invalid command" }, { status: 400 });
  }

  if (!all && (!Array.isArray(ids) || ids.length === 0)) {
    return Response.json({ error: "No stations selected" }, { status: 400 });
  }

  try {
    await stationRepo.setCommand(all ? [] : ids, command, !!all);

    // Resolve station names for a readable audit log
    let names: string[] = [];
    try {
      const stations = await stationRepo.findAll();
      names = all
        ? stations.map((s) => s.name)
        : stations.filter((s) => (ids as string[]).includes(s.id)).map((s) => s.name);
    } catch {
      // ignore
    }

    void activityLog.logStationCommand(
      "Admin",
      names.length > 0 ? names : all ? ["all"] : (ids as string[]),
      command as "shutdown" | "restart" | "screenshot"
    );

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to send command";
    return Response.json({ error: message }, { status: 500 });
  }
}
