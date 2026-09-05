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

  async logSessionStart(userName: string, stationName: string, payment: string, amount: number, gfundsUsed: number, pointsUsed: number): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "session_start",
      target_type: "session",
      target_id: `${userName}-${stationName}`,
      details: { station: stationName, payment, amount, gfundsUsed, pointsUsed },
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

  async logSessionLogout(userName: string, stationName: string): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "session_logout",
      target_type: "session",
      target_id: `${userName}-${stationName}`,
      details: { station: stationName },
    });
  }

  async logSessionResume(userName: string, stationName: string): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "session_resume",
      target_type: "session",
      target_id: `${userName}-${stationName}`,
      details: { station: stationName },
    });
  }

  async logSessionShare(userName: string, targetName: string, minutes: number, sourceStation: string): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "session_share",
      target_type: "user",
      target_id: targetName,
      details: { minutes, source_station: sourceStation },
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

  async logPlayerLogin(userName: string): Promise<void> {
    await this.repo.log({
      actor_name: userName,
      actor_role: "player",
      action: "player_login",
      target_type: "user",
      target_id: userName,
      details: {},
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
}