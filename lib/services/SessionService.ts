import { SessionRepository } from "@/lib/repositories/SessionRepository";
import { RedeemRepository } from "@/lib/repositories/RedeemRepository";
import { StationRepository } from "@/lib/repositories/StationRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type { HistoryItem, PublicUser, Session, User } from "@/types";

export const POINTS_PER_REDEEM = 20;
export const MINUTES_PER_POINT_REDEEM = 8;
export const MINUTES_PER_PESO = 4;

function sortByDateDesc(a: { created_at: string }, b: { created_at: string }) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export class SessionService {
  private sessionRepo = new SessionRepository();
  private redeemRepo = new RedeemRepository();
  private stationRepo = new StationRepository();
  private userRepo = new UserRepository();

  async getFullUserHistory(
    userId: string
  ): Promise<
    | { error: string }
    | {
        user: User;
        stats: { total_minutes: number; total_hours: string };
        history: HistoryItem[];
      }
  > {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      return { error: "User not found" };
    }

    const sessions = await this.sessionRepo.findByUserName(user.name);
    const redeems = await this.redeemRepo.findByUserId(userId);

    const totalMinutes = sessions.reduce((sum, s) => sum + (s.minutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    const formattedSessions: HistoryItem[] = sessions.map((s) => ({
      ...s,
      type: "session",
      amount: s.amount,
    }));

    const formattedRedeems: HistoryItem[] = redeems.map((r) => ({
      ...r,
      type: "redeem",
      amount: r.points_used,
    }));

    const history = [...formattedSessions, ...formattedRedeems].sort(sortByDateDesc);

    return {
      user,
      stats: {
        total_minutes: totalMinutes,
        total_hours: `${hours}h ${mins}m`,
      },
      history,
    };
  }

  async getUserSessionHistory(
    userId: string
  ): Promise<{ user: PublicUser | null; history: HistoryItem[] }> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      return { user: null, history: [] };
    }

    const sessions = await this.sessionRepo.findByUserId(userId);
    const redeems = await this.redeemRepo.findByUserId(userId);

    const formattedSessions: HistoryItem[] = sessions.map((s) => ({
      ...s,
      type: "session",
      status: "paid",
      amount: s.amount,
    }));

    const formattedRedeems: HistoryItem[] = redeems.map((r) => ({
      ...r,
      type: "redeem",
      amount: r.points_used,
    }));

    const history = [...formattedSessions, ...formattedRedeems].sort(sortByDateDesc);

    return {
      user: {
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url,
      },
      history,
    };
  }

  async addSession(
    name: string,
    amount: number,
    minutes: number,
    points: number
  ): Promise<void> {
    await this.sessionRepo.create({
      user_name: name,
      amount,
      minutes,
      points,
      status: "completed",
      starts_at: new Date().toISOString(),
      ends_at: new Date().toISOString(),
      payment_method: "cash",
      points_used: 0,
      gfunds_used: 0,
    });

    const user = await this.userRepo.findByName(name);
    if (user) {
      await this.userRepo.updatePointsByName(name, user.points + points);
    }
  }

  async startSession(params: {
    userId: string;
    stationName: string;
    payment: "points" | "gfunds";
    points?: number;
    gfunds?: number;
  }): Promise<
    | { error: string }
    | {
        success: true;
        session: Session;
        remaining_seconds: number;
        user: User;
      }
  > {
    const { userId, stationName, payment } = params;

    const user = await this.userRepo.findById(userId);
    if (!user) {
      return { error: "User not found" };
    }

    const station = await this.stationRepo.findByName(stationName);
    if (!station) {
      return { error: "Station not found. Add it in the admin panel first." };
    }

    await this.sessionRepo.expireOverdue();

    const occupant = await this.sessionRepo.findActiveByStation(stationName);
    if (occupant && occupant.user_id !== userId) {
      return { error: `Station is occupied by ${occupant.user_name}` };
    }

    let minutes = 0;
    let pointsUsed = 0;
    let gfundsUsed = 0;

    if (payment === "points") {
      const pts = params.points ?? 0;
      if (!Number.isInteger(pts) || pts <= 0 || pts % POINTS_PER_REDEEM !== 0) {
        return { error: `Points must be a multiple of ${POINTS_PER_REDEEM}` };
      }
      const available = user.points - (user.reserved_points || 0);
      if (pts > available) {
        return { error: "Not enough points" };
      }
      pointsUsed = pts;
      minutes = (pts / POINTS_PER_REDEEM) * MINUTES_PER_POINT_REDEEM;
    } else {
      const g = params.gfunds ?? 0;
      if (!Number.isInteger(g) || g <= 0) {
        return { error: "Gfunds must be a positive whole number" };
      }
      if (g > (user.gfunds || 0)) {
        return { error: "Not enough gfunds" };
      }
      gfundsUsed = g;
      minutes = g * MINUTES_PER_PESO;
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + minutes * 60 * 1000);

    try {
      const session = await this.sessionRepo.create({
        user_name: user.name,
        user_id: user.id,
        amount: payment === "gfunds" ? gfundsUsed : 0,
        minutes,
        points: pointsUsed,
        station_name: stationName,
        status: "active",
        starts_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        payment_method: payment,
        points_used: pointsUsed,
        gfunds_used: gfundsUsed,
      });

      const updatedUser = await this.userRepo.findById(userId);
      const freshUser = updatedUser ?? user;
      await this.userRepo.updatePointsById(
        userId,
        freshUser.points - pointsUsed
      );
      await this.userRepo.updateGfundsById(userId, freshUser.gfunds - gfundsUsed);

      return {
        success: true,
        session,
        remaining_seconds: minutes * 60,
        user: {
          ...freshUser,
          points: freshUser.points - pointsUsed,
          gfunds: freshUser.gfunds - gfundsUsed,
        },
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start session";
      return { error: message };
    }
  }

  async endStationSession(
    stationName: string
  ): Promise<{ success: true } | { error: string }> {
    await this.sessionRepo.endActiveByStation(stationName);
    return { success: true };
  }

  async getActiveForUser(
    userId: string
  ): Promise<{ session: Session | null; remaining_seconds: number }> {
    await this.sessionRepo.expireOverdue();
    const session = await this.sessionRepo.findActiveForUser(userId);
    if (!session || !session.ends_at) {
      return { session: null, remaining_seconds: 0 };
    }
    const remaining = Math.max(
      0,
      Math.floor((new Date(session.ends_at).getTime() - Date.now()) / 1000)
    );
    return { session, remaining_seconds: remaining };
  }

  async getAgentStatus(agentKey: string): Promise<
    | { error: string }
    | {
        locked: boolean;
        remaining_seconds: number;
        station_name: string;
        user_name: string | null;
      }
  > {
    const station = await this.stationRepo.findByKey(agentKey);
    if (!station) {
      return { error: "Invalid agent key" };
    }

    await this.stationRepo.updateLastSeen(station.id);
    await this.sessionRepo.expireOverdue();

    const active = await this.sessionRepo.findActiveByStation(station.name);
    if (!active || !active.ends_at) {
      return {
        locked: true,
        remaining_seconds: 0,
        station_name: station.name,
        user_name: null,
      };
    }

    const remaining = Math.max(
      0,
      Math.floor((new Date(active.ends_at).getTime() - Date.now()) / 1000)
    );

    return {
      locked: remaining <= 0,
      remaining_seconds: remaining,
      station_name: station.name,
      user_name: active.user_name,
    };
  }

  async getStationsWithStatus(): Promise<
    {
      id: string;
      name: string;
      agent_key: string;
      last_seen_at: string | null;
      online: boolean;
      active: Session | null;
      remaining_seconds: number;
    }[]
  > {
    await this.sessionRepo.expireOverdue();
    const [stations, activeSessions] = await Promise.all([
      this.stationRepo.findAll(),
      this.sessionRepo.findAllActive(),
    ]);

    const byStation = new Map<string, Session>();
    for (const s of activeSessions) {
      if (!s.station_name) continue;
      const cur = byStation.get(s.station_name);
      if (!cur || !cur.ends_at || (s.ends_at && s.ends_at > cur.ends_at)) {
        byStation.set(s.station_name, s);
      }
    }

    return stations.map((s) => {
      const active = byStation.get(s.name) ?? null;
      const remaining = active?.ends_at
        ? Math.max(
            0,
            Math.floor((new Date(active.ends_at).getTime() - Date.now()) / 1000)
          )
        : 0;
      return {
        id: s.id,
        name: s.name,
        agent_key: s.agent_key,
        last_seen_at: s.last_seen_at,
        online:
          !!s.last_seen_at &&
          Date.now() - new Date(s.last_seen_at).getTime() < 90 * 1000,
        active,
        remaining_seconds: remaining,
      };
    });
  }
}
