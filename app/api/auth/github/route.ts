import { redirect } from "next/navigation";

export async function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: "GitHub OAuth not configured" }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/auth/github/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user",
  });

  redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
