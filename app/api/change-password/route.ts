import { AuthService } from "@/lib/services/AuthService";

const authService = new AuthService();

export async function POST(req: Request) {
  const { user_id, oldPin, newPin } = await req.json();

  const result = await authService.changePassword(user_id, oldPin, newPin);

  if ("error" in result) {
    return Response.json({ error: result.error });
  }

  return Response.json({ success: true });
}
