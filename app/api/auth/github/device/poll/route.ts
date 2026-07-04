import { AuthService } from "@/lib/services/AuthService";

export async function POST(req: Request) {
  const { device_code } = await req.json();
  if (!device_code) {
    return Response.json({ error: "Missing device_code" }, { status: 400 });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return Response.json({ error: "GitHub OAuth not configured" }, { status: 500 });
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  const data = await res.json();

  if (data.error) {
    if (data.error === "authorization_pending") {
      return Response.json({ status: "pending" });
    }
    if (data.error === "slow_down") {
      return Response.json({ status: "slow_down" });
    }
    return Response.json({ error: data.error_description || data.error }, { status: 400 });
  }

  const accessToken = data.access_token;
  if (!accessToken) {
    return Response.json({ error: "No access token received" }, { status: 400 });
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const githubUser = await userRes.json();
  if (!githubUser.id) {
    return Response.json({ error: "Failed to fetch GitHub user" }, { status: 400 });
  }

  const authService = new AuthService();
  const result = await authService.loginOrRegisterWithGithub(
    String(githubUser.id),
    githubUser.login,
    githubUser.avatar_url
  );

  return Response.json({ status: "authorized", user: result });
}
