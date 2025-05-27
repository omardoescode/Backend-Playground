import { Hono } from "hono";
import { config } from "dotenv";
import { getCookie, setCookie } from "hono/cookie";
import { CookieOptions } from "hono/utils/cookie";
config();

const app = new Hono();

app.get("/ping", (c) => c.text("pong"));
app.get("/auth/google", (c) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: "code",
    scope: "email profile",
    state: process.env.GOOGLE_STATE!,
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
  // Validate parameters
  if (!state || !code) {
    return c.text("Missing 'code' or 'state'", 400);
  }
  console.log(state, process.env.GOOGLE_STATE);
  if (state !== process.env.GOOGLE_STATE) {
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
      include_granted_scopes: "true",
    }).toString(),
  });

  const json = await tokenRes.json();
  // console.log(json); // debug
  const { access_token, refresh_token } = json;

  const options: CookieOptions = {
    httpOnly: true,
    secure: true,
    path: "/",
  };

  setCookie(c, "access_token", access_token, options);
  setCookie(c, "refresh_token", refresh_token, options);
  return c.redirect("http://localhost:3000/auth/user");
});

app.get("/auth/user", async (c) => {
  const accessToken = getCookie(c, "access_token");

  if (!accessToken) {
    return c.text("Unauthorized", 401);
  }

  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    return c.text("Failed to fetch user info", 500);
  }

  const user = await res.json();
  console.log(user);
  const username = user.name || user.email;

  return c.text(`Hello, ${username}`);
});
export default app;
