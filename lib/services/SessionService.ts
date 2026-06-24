import { SessionRepository } from "@/lib/repositories/SessionRepository";
import { RedeemRepository } from "@/lib/repositories/RedeemRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type { HistoryItem, PublicUser, User } from "@/types";

function sortByDateDesc(a: { created_at: string }, b: { created_at: string }) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export class SessionService {
  private sessionRepo = new SessionRepository();
  private redeemRepo = new RedeemRepository();
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
    await this.sessionRepo.create({ user_name: name, amount, minutes, points });

    const user = await this.userRepo.findByName(name);
    if (user) {
      await this.userRepo.updatePointsByName(name, user.points + points);
    }
  }
}
