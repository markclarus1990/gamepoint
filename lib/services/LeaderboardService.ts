import { SessionRepository } from "@/lib/repositories/SessionRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type { LeaderboardEntry } from "@/types";

type LeaderboardAccumulator = Record<string, { name: string; total_minutes: number }>;

export class LeaderboardService {
  private sessionRepo = new SessionRepository();
  private userRepo = new UserRepository();

  async getTopPlayers(limit?: number): Promise<LeaderboardEntry[]> {
    const sessions = await this.sessionRepo.findAllWithMinutes(limit);

    const grouped = (sessions || []).reduce<LeaderboardAccumulator>((acc, session) => {
      if (!acc[session.user_name]) {
        acc[session.user_name] = { name: session.user_name, total_minutes: 0 };
      }
      acc[session.user_name].total_minutes += session.minutes || 0;
      return acc;
    }, {});

    const sorted = Object.values(grouped).sort(
      (a, b) => b.total_minutes - a.total_minutes
    );

    const names = sorted.map((u) => u.name);
    const users = await this.userRepo.findNamesWithAvatars(names);

    return sorted.map((player) => ({
      ...player,
      avatar_url:
        users?.find((u) => u.name === player.name)?.avatar_url ??
        "https://placehold.co/100x100/png",
    }));
  }
}
