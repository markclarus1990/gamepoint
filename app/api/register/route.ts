import { AuthService } from "@/lib/services/AuthService";

const authService = new AuthService();

export async function POST(req: Request) {
  try {
    const { name, pin } = await req.json();

    const result = await authService.register(name, pin);

    if ("error" in result) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message: string }).message)
        : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
