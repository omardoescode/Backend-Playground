import { Hono } from "hono";
import { config } from "dotenv";
import { withGoogleAuth } from "./middleware";
import { setCookie, getCookie } from "./utils";
config();

const app = new Hono();

app.get("/ping", (c) => c.text("pong"));
app.get("/auth/google", (c) => {
  const generatedState = crypto.randomUUID();
  setCookie(c, "oauth_state", generatedState, { maxAge: 300 /* 5 minutes */ });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "email profile",
    state: generatedState,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  return c.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
});

app.get("/auth/callback", async (c) => {
  const state = c.req.query("state");
  const code = c.req.query("code");
  const actualState = getCookie(c, "oauth_state");

  // Validate parameters
  if (!actualState) return c.text("Invalid request", 400);
  if (!state || !code) {
    return c.text("Missing 'code' or 'state'", 400);
  }

  if (state !== actualState) {
    return c.text("Invalid state parameter", 403);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    }).toString(),
  });

  const json = await tokenRes.json();
  const modifiedJson = {
    ...json,
    expires_in: new Date(Date.now() + json.expires_in * 1000).toISOString(),
    // expires_in: new Date(Date.now() + 10 * 1000).toISOString(), // NOTE: Simulat e 10 seconds expiration time to test refresh_tokens
  };

  setCookie(c, "session", JSON.stringify(json));
  return c.redirect("http://localhost:3000/auth/user");
});

app.get("/auth/user", withGoogleAuth, async (c) => {
  const session = getCookie(c, "session");
  if (!session) {
    return c.text("Unauthorized", 401);
  }
  const { access_token } = JSON.parse(session);

  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (!res.ok) {
    return c.text("Failed to fetch user info", 500);
  }

  const user = await res.json();
  const username = user.name || user.email;

  return c.text(`Hello, ${username}`);
});
export default app;
