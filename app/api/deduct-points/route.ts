import { UserRepository } from "@/lib/repositories/UserRepository";

const userRepo = new UserRepository();

export async function POST(req: Request) {
  const { name, points } = await req.json();

  if (!name || !points || points <= 0) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const user = await userRepo.findByName(name);
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const newPoints = Math.max(0, user.points - points);
  await userRepo.updatePointsByName(name, newPoints);

  return Response.json({ success: true });
}
