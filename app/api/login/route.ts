import { AuthService } from "@/lib/services/AuthService";
import { ActivityLogService } from "@/lib/services/ActivityLogService";

const authService = new AuthService();
const activityLog = new ActivityLogService();

export async function POST(req: Request) {
  const { name, pin } = await req.json();

  const result = await authService.login(name, pin);

  if ("error" in result) {
    void activityLog.logPlayerLoginFailed(String(name ?? "unknown"), result.error);
    return Response.json({ error: result.error });
  }

  // result is LoginResponse with name/points/gfunds/etc.
  const userName = (result as { name?: string }).name ?? String(name ?? "unknown");
  void activityLog.logPlayerLogin(userName);

  return Response.json(result);
}
