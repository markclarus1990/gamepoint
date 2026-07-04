export async function POST() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: "GitHub OAuth not configured" }, { status: 500 });
  }

  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: "read:user",
    }),
  });

  const data = await res.json();

  if (data.error) {
    return Response.json({ error: data.error_description || "Device flow failed" }, { status: 400 });
  }

  return Response.json({
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    interval: data.interval,
  });
}
