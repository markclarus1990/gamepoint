import { AuthService } from "@/lib/services/AuthService";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return Response.redirect(
      new URL("/login?error=github_auth_failed", process.env.NEXT_PUBLIC_URL || "http://localhost:3000")
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json({ error: "GitHub OAuth not configured" }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/api/auth/github/callback`;

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return Response.redirect(
      new URL("/login?error=github_token_failed", process.env.NEXT_PUBLIC_URL || "http://localhost:3000")
    );
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const githubUser = await userRes.json();

  if (!githubUser.id) {
    return Response.redirect(
      new URL("/login?error=github_user_failed", process.env.NEXT_PUBLIC_URL || "http://localhost:3000")
    );
  }

  const authService = new AuthService();
  const result = await authService.loginOrRegisterWithGithub(
    String(githubUser.id),
    githubUser.login,
    githubUser.avatar_url
  );

  const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

  const userParam = encodeURIComponent(JSON.stringify(result));
  return Response.redirect(
    new URL(`/login?github_user=${userParam}`, baseUrl)
  );
}
