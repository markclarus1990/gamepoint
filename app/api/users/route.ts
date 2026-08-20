import { UserService } from "@/lib/services/UserService";
import { SessionRepository } from "@/lib/repositories/SessionRepository";
import type { User } from "@/types";

const userService = new UserService();

async function attachRemaining(
  users: User[]
): Promise<(User & { remaining_seconds?: number; total_available_seconds?: number })[]> {
  if (users.length === 0) return users;

  const repo = new SessionRepository();
  const [active, paused] = await Promise.all([
    repo.findAllActive(),
    repo.findAllPaused(),
  ]);

  const remainingByUser = new Map<string, number>();
  for (const s of active) {
    if (!s.user_id || !s.ends_at) continue;
    const remaining = Math.max(
      0,
      Math.floor((new Date(s.ends_at).getTime() - Date.now()) / 1000)
    );
    const cur = remainingByUser.get(s.user_id) ?? 0;
    if (remaining > cur) remainingByUser.set(s.user_id, remaining);
  }

  const pausedByUser = new Map<string, number>();
  for (const s of paused) {
    if (!s.user_id) continue;
    const secs = s.resume_seconds ?? 0;
    if (secs <= 0) continue;
    const cur = pausedByUser.get(s.user_id) ?? 0;
    if (secs > cur) pausedByUser.set(s.user_id, secs);
  }

  return users.map((u) => {
    const remaining = remainingByUser.get(u.id) ?? 0;
    const pausedSeconds = pausedByUser.get(u.id) ?? 0;
    const credit = (u.time_credit_minutes ?? 0) * 60;
    return {
      ...u,
      remaining_seconds: remaining || undefined,
      total_available_seconds: remaining + pausedSeconds + credit || undefined,
    };
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page");
  const pageSize = searchParams.get("pageSize");

  if (page && pageSize) {
    const result = await userService.getUsers("points", Number(page), Number(pageSize));
    const data = await attachRemaining(result.data);
    return Response.json({ data, total: result.total, page: Number(page), pageSize: Number(pageSize) });
  }

  const result = await userService.getUsers("points");
  const data = await attachRemaining(result.data);
  return Response.json(data);
}