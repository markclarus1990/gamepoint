import { AuthService } from "@/lib/services/AuthService";

const authService = new AuthService();

export async function POST(req: Request) {
  const { name, pin } = await req.json();

  const result = await authService.login(name, pin);

  if ("error" in result) {
    return Response.json({ error: result.error });
  }

  return Response.json(result);
}
