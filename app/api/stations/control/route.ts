import { StationRepository } from "@/lib/repositories/StationRepository";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const stationRepo = new StationRepository();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { ids, all, action } = await req.json();

  if (action !== "start" && action !== "stop") {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }
  if (!all && (!Array.isArray(ids) || ids.length === 0)) {
    return Response.json({ error: "No stations selected" }, { status: 400 });
  }

  try {
    if (action === "stop") {
      await stationRepo.setRemoteControl(all ? [] : ids, false, !!all);
      // Log station control stop
      await activityLog.logStationControlStop(
        "Admin",
        all ? "all PCs" : (ids[0] ? `PC-${ids[0].substring(0, 8)}` : "unknown")
      );
      return Response.json({ success: true });
    }

    const stations = await stationRepo.findAll();
    const targets = all
      ? stations
      : stations.filter((s) => ids.includes(s.id));
    if (targets.length === 0) {
      return Response.json({ error: "No stations selected" }, { status: 400 });
    }

    const offline = targets.filter(
      (s) =>
        !s.last_seen_at ||
        Date.now() - new Date(s.last_seen_at).getTime() > 45 * 1000
    );
    if (offline.length > 0) {
      return Response.json(
        { error: `${offline.map((s) => s.name).join(", ")} is offline` },
        { status: 400 }
      );
    }

    const pending = targets.filter((s) => !!s.command);
    if (pending.length > 0) {
      return Response.json(
        {
          error: `${pending.map((s) => s.name).join(", ")} has a pending command — cancel it first`,
        },
        { status: 400 }
      );
    }

    await stationRepo.setRemoteControl(
      targets.map((s) => s.id),
      true
    );
    // Log station control start
    await activityLog.logStationControlStart(
      "Admin",
      targets[0]?.name || "unknown"
    );
    return Response.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to start remote control";
    return Response.json({ error: message }, { status: 500 });
  }
}
