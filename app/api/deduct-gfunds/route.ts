import { UserRepository } from "@/lib/repositories/UserRepository";

const userRepo = new UserRepository();

export async function POST(req: Request) {
  const { name, gfunds } = await req.json();

  if (!name || !gfunds || gfunds <= 0) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await userRepo.findByName(name);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const newGfunds = Math.max(0, user.gfunds - gfunds);
  await userRepo.updateGfundsById(user.id, newGfunds);

  return Response.json({ success: true });
}
