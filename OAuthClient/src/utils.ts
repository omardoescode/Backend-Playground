import { Context } from "hono";
import {
  setCookie as setHonoCookie,
  getCookie as getHonoCookie,
} from "hono/cookie";
import { CookieOptions } from "hono/utils/cookie";

export const setCookie = (
  c: Context,
  key: string,
  value: string,
  additionalOptions?: CookieOptions,
) => {
  const opts: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" ? true : false,
    path: "/",
    sameSite: "Lax",
  };

  setHonoCookie(c, key, value, { ...opts, ...additionalOptions });
};

export const getCookie = getHonoCookie;
