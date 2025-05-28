import { MiddlewareHandler } from "hono";
import { getCookie, setCookie } from "./utils";

export const withGoogleAuth: MiddlewareHandler = async (c, next) => {
  const session = getCookie(c, "session");
  if (!session) return c.text("Unauthorized", 401);

  // console.log("refreshing");
  const parsedSession = JSON.parse(session);
  const { expires_in: expiresIn, refresh_token: refreshToken } = parsedSession;
  if (isNaN(Date.parse(expiresIn))) return c.text("Unauthorized", 401);

  const isExpired = Date.now() >= new Date(expiresIn).getTime();

  if (!isExpired) return await next();

  // TODO: Add checks for refresh_token expiration itself
  // Refresh the access token
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  // console.log(data);
  setCookie(
    c,
    "session",
    JSON.stringify({
      ...parsedSession,
      ...data,
    }),
  );
  return await next();
};
