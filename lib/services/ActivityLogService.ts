import { ActivityLogRepository } from "@/lib/repositories/ActivityLogRepository";

export class ActivityLogService {
  private repo = new ActivityLogRepository();

  async logAdminLoad(adminName: string, targetName: string, gfunds: number, points: number): Promise<void> {
    await this.repo.log({
      actor_name: adminName,
      actor_role: "admin",
      action: "admin_load",
      target_type: "user",
      target_id: targetName,
      details: { gfunds, points },
    });
  }

  async logAdminDeductPoints(adminName: string, targetName: string, points: number): Promise<void> {
    await this.repo.log({
      actor_name: adminName,
      actor_role: "admin",
      action: "admin_deduct_points",
      target_type: "user",
      target_id: targetName,
      details: { points },
    });
  }

  async logAdminDeductGfunds(adminName: string, targetName: string, gfunds: number): Promise<void> {
    await this.repo.log({
      actor_name: adminName,
      actor_role: "admin",
      action: "admin_deduct_gfunds",
      target_type: "user",
      target_id: targetName,
      details: { gfunds },
    });
  }

  async logSessionStart(
    userName: string,
    stationName: string,
    payment: string,
    amount: number,
    gfundsUsed: number,
    pointsUsed: number,
    extra?: { minutes?: number; remaining_seconds?: number; credit_minutes?: number }
  ): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "session_start",
      target_type: "session",
      target_id: `${userName}-${stationName}`,
      details: {
        station: stationName,
        payment,
        amount,
        gfundsUsed,
        pointsUsed,
        ...(extra?.minutes !== undefined ? { minutes: extra.minutes } : {}),
        ...(extra?.remaining_seconds !== undefined ? { remaining_seconds: extra.remaining_seconds } : {}),
        ...(extra?.credit_minutes !== undefined ? { credit_minutes: extra.credit_minutes } : {}),
      },
    });
  }

  async logCreditConsume(userName: string, stationName: string, creditMinutes: number, remainingSeconds: number): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "credit_consume",
      target_type: "session",
      target_id: `${userName}-${stationName}`,
      details: { station: stationName, credit_minutes: creditMinutes, remaining_seconds: remainingSeconds },
    });
  }

  async logSessionEnd(userName: string, stationName: string): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "session_end",
      target_type: "session",
      target_id: `${userName}-${stationName}`,
      details: { station: stationName },
    });
  }

  async logSessionLogout(userName: string, stationName: string, extra?: { remaining_seconds?: number; was_paused?: boolean }): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "session_logout",
      target_type: "session",
      target_id: `${userName}-${stationName}`,
      details: {
        station: stationName,
        ...(extra?.remaining_seconds !== undefined ? { remaining_seconds: extra.remaining_seconds } : {}),
        ...(extra?.was_paused !== undefined ? { was_paused: extra.was_paused } : {}),
      },
    });
  }

  async logSessionResume(
    userName: string,
    stationName: string,
    extra?: { resume_seconds?: number; remaining_seconds?: number }
  ): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "session_resume",
      target_type: "session",
      target_id: `${userName}-${stationName}`,
      details: {
        station: stationName,
        ...(extra?.resume_seconds !== undefined ? { resume_seconds: extra.resume_seconds } : {}),
        ...(extra?.remaining_seconds !== undefined ? { remaining_seconds: extra.remaining_seconds } : {}),
      },
    });
  }

  async logSessionShare(
    userName: string,
    targetName: string,
    minutes: number,
    sourceStation: string,
    extra?: {
      target_station?: string | null;
      giver_remaining_before?: number;
      target_credit_before?: number;
      target_station_before?: string | null;
    }
  ): Promise<void> {
    const details: Record<string, unknown> = {
      minutes,
      source_station: sourceStation,
    };
    if (extra?.target_station) details.target_station = extra.target_station;
    if (extra?.giver_remaining_before !== undefined) details.giver_remaining_before = extra.giver_remaining_before;
    if (extra?.target_credit_before !== undefined) details.target_credit_before = extra.target_credit_before;
    if (extra?.target_station_before) details.target_station_before = extra.target_station_before;
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "session_share",
      target_type: "user",
      target_id: targetName,
      details,
    });
  }

  async logSessionShareFailed(giverName: string, targetName: string, minutes: number, sourceStation: string, reason: string): Promise<void> {
    await this.repo.log({
      actor_name: giverName,
      actor_role: "player",
      action: "session_share_failed",
      target_type: "user",
      target_id: targetName,
      details: { minutes, source_station: sourceStation, reason },
    });
  }

  async logAddTime(
    userName: string,
    stationName: string,
    payment: string,
    minutesAdded: number,
    extra: { gfundsUsed: number; pointsUsed: number; remaining_seconds: number }
  ): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "add_time",
      target_type: "session",
      target_id: `${userName}-${stationName}`,
      details: {
        station: stationName,
        payment,
        minutes_added: minutesAdded,
        gfundsUsed: extra.gfundsUsed,
        pointsUsed: extra.pointsUsed,
        remaining_seconds: extra.remaining_seconds,
      },
    });
  }

  async logAdminOpenTime(adminName: string, stationName: string, minutes: number, pesos: number): Promise<void> {
    await this.repo.log({
      actor_name: adminName,
      actor_role: "admin",
      action: "admin_open_time",
      target_type: "station",
      target_id: stationName,
      details: { minutes, pesos },
    });
  }

  async logRedeemApprove(adminName: string, userName: string, pointsUsed: number, minutes: number): Promise<void> {
    await this.repo.log({
      actor_name: adminName,
      actor_role: "admin",
      action: "redeem_approve",
      target_type: "user",
      target_id: userName,
      details: { points_used: pointsUsed, minutes },
    });
  }

  async logShopGrant(adminName: string, userName: string, pointsSpent: number, productName: string): Promise<void> {
    await this.repo.log({
      actor_name: adminName,
      actor_role: "admin",
      action: "shop_grant",
      target_type: "user",
      target_id: userName,
      details: { points_spent: pointsSpent, product: productName },
    });
  }

  async logStationCommand(adminName: string, stations: string[], command: "shutdown" | "restart" | "screenshot"): Promise<void> {
    await this.repo.log({
      actor_name: adminName,
      actor_role: "admin",
      action: "station_command",
      target_type: "stations",
      target_id: stations.join(","),
      details: { command, station_count: stations.length },
    });
  }

  async logStationControlStart(adminName: string, stationName: string): Promise<void> {
    await this.repo.log({
      actor_name: adminName,
      actor_role: "admin",
      action: "station_control_start",
      target_type: "station",
      target_id: stationName,
      details: {},
    });
  }

  async logStationControlStop(adminName: string, stationName: string): Promise<void> {
    await this.repo.log({
      actor_name: adminName,
      actor_role: "admin",
      action: "station_control_stop",
      target_type: "station",
      target_id: stationName,
      details: {},
    });
  }

  async logAgentScreenshot(stationName: string, imageBytes: number, url?: string): Promise<void> {
    await this.repo.log({
      actor_name: stationName,
      actor_role: "agent",
      action: "agent_screenshot",
      target_type: "station",
      target_id: stationName,
      details: { station: stationName, image_bytes: imageBytes, ...(url ? { url } : {}) },
    });
  }

  async logAgentCommandDone(stationName: string, command: string): Promise<void> {
    await this.repo.log({
      actor_name: stationName,
      actor_role: "agent",
      action: "agent_command_done",
      target_type: "station",
      target_id: stationName,
      details: { station: stationName, command },
    });
  }

  async logPlayerLogin(userName: string, extra?: { station?: string }): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "player_login",
      target_type: "user",
      target_id: userName,
      details: { ...(extra?.station ? { station: extra.station } : {}) },
    });
  }

  async logPlayerLoginFailed(attemptName: string, reason: string): Promise<void> {
    await this.repo.log({
      actor_name: attemptName || "unknown",
      actor_role: "player",
      action: "player_login_failed",
      target_type: "user",
      target_id: attemptName || "unknown",
      details: { reason },
    });
  }

  async logPlayerLogout(userName: string): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "player_logout",
      target_type: "user",
      target_id: userName,
      details: {},
    });
  }

  async logPinChange(userName: string): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "pin_change",
      target_type: "user",
      target_id: userName,
      details: {},
    });
  }
}
