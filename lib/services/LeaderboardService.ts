import { SessionRepository } from "@/lib/repositories/SessionRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import type { LeaderboardEntry } from "@/types";

type LeaderboardAccumulator = Record<string, { name: string; total_minutes: number }>;

const EXCLUDED_PLAYERS = new Set(["test", "test2", "test3", "test4", "test5"]);

export class LeaderboardService {
  private sessionRepo = new SessionRepository();
  private userRepo = new UserRepository();

  async getTopPlayers(limit = 5): Promise<LeaderboardEntry[]> {
    const capped = Math.min(Math.max(limit || 5, 1), 50);

    try {
      const rows = await this.sessionRepo.findTopAggregated(capped);
      if (rows.length === 0) return [];
      const users = await this.userRepo.findNamesWithAvatars(rows.map((r) => r.name));
      return rows.map((player) => ({
        ...player,
        avatar_url:
          users?.find((u) => u.name === player.name)?.avatar_url ??
          "https://placehold.co/100x100/png",
      }));
    } catch {
      return this.getTopPlayersLegacy(capped);
    }
  }

  async getPlayerRank(playerName: string): Promise<(LeaderboardEntry & { rank: number }) | null> {
    const clean = playerName.trim();
    if (!clean) return null;

    try {
      const row = await this.sessionRepo.findPlayerRank(clean);
      if (!row) return null;
      const user = await this.userRepo.findByName(row.name);
      return {
        name: row.name,
        total_minutes: row.total_minutes,
        rank: row.rank,
        avatar_url: user?.avatar_url ?? "https://placehold.co/100x100/png",
      };
    } catch {
      return this.getPlayerRankLegacy(clean);
    }
  }

  private async getPlayerRankLegacy(playerName: string) {
    const all = await this.getTopPlayersLegacy(1000);
    const idx = all.findIndex((p) => p.name.toLowerCase() === playerName.toLowerCase().trim());
    if (idx === -1) return null;
    return { ...all[idx], rank: idx + 1 };
  }

  private async getTopPlayersLegacy(limit: number): Promise<LeaderboardEntry[]> {
    const sessions = await this.sessionRepo.findAllWithMinutes();

    const grouped = (sessions || []).reduce<LeaderboardAccumulator>((acc, session) => {
      if (!acc[session.user_name]) {
        acc[session.user_name] = { name: session.user_name, total_minutes: 0 };
      }
      acc[session.user_name].total_minutes += session.minutes || 0;
      return acc;
    }, {});

    const sorted = Object.values(grouped)
      .filter((u) => !EXCLUDED_PLAYERS.has(u.name.toLowerCase().trim()))
      .sort((a, b) => b.total_minutes - a.total_minutes);

    const names = sorted.map((u) => u.name);
    const users = await this.userRepo.findNamesWithAvatars(names);

    return sorted.slice(0, limit).map((player) => ({
      ...player,
      avatar_url:
        users?.find((u) => u.name === player.name)?.avatar_url ??
        "https://placehold.co/100x100/png",
    }));
  }
}
