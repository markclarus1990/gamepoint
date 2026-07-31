import { UserRepository } from "@/lib/repositories/UserRepository";

const userRepo = new UserRepository();

export async function POST(req: Request) {
  const { user_id, gfunds, points } = await req.json();

  if (!user_id) {
    return Response.json({ error: "User ID is required" }, { status: 400 });
  }

  const g = Number(gfunds) || 0;
  const p = Number(points) || 0;

  if (g < 0 || p < 0 || !Number.isInteger(g) || !Number.isInteger(p)) {
    return Response.json({ error: "Invalid amount" }, { status: 400 });
  }

  if (g <= 0 && p <= 0) {
    return Response.json({ error: "Enter a gfunds or points amount" }, { status: 400 });
  }

  const user = await userRepo.findById(user_id);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  try {
    if (g > 0) {
      await userRepo.updateGfundsById(user.id, (user.gfunds || 0) + g);
    }
    if (p > 0) {
      await userRepo.updatePointsById(user.id, user.points + p);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load account";
    return Response.json({ error: message }, { status: 500 });
  }

  const updated = await userRepo.findById(user.id);
  return Response.json({ success: true, user: updated });
}
