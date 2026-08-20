import { UserService } from "@/lib/services/UserService";
import { SessionRepository } from "@/lib/repositories/SessionRepository";
import type { User } from "@/types";

const userService = new UserService();

async function attachRemaining(users: User[]): Promise<(User & { remaining_seconds?: number })[]> {
  if (users.length === 0) return users;

  const sessions = await new SessionRepository().findAllActive();
  const remainingByUser = new Map<string, number>();

  for (const s of sessions) {
    if (!s.user_id || !s.ends_at) continue;
    const remaining = Math.max(
      0,
      Math.floor((new Date(s.ends_at).getTime() - Date.now()) / 1000)
    );
    if (remaining > 0) remainingByUser.set(s.user_id, remaining);
  }

  return users.map((u) => ({
    ...u,
    remaining_seconds: remainingByUser.get(u.id),
  }));
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