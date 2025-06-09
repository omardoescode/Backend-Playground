import { Hono } from "hono";
import { getConnInfo } from "hono/bun";
import { createClient } from "redis";

const FULL_BUCKET_TOKEN_COUNT = 20;
const TOKEN_REFILL_INTERVAL_MS = 1000 * 60; // every minute
const TOKENS_PER_INTERVAL = 1;
const EXPIRY_IN_SECONDS = 60 * 60;

const redis = createClient();

await redis
  .connect()
  .then((_res) => console.log("Connected to redis successfully"));

const app = new Hono();

app.get("/", async (c) => {
  const info = getConnInfo(c);
  const addr = info.remote.address;
  console.log(info.remote);
  if (addr) {
    const key = `ratelimit:${addr}`;
    let value = await redis.get(key);
    if (!value) {
      await redis.set(key, FULL_BUCKET_TOKEN_COUNT, { EX: EXPIRY_IN_SECONDS });
      value = `${FULL_BUCKET_TOKEN_COUNT}`;
    }

    const tokens: number = parseInt(value);
    if (tokens < 1) return c.text("Rate Limit reached", 429);

    console.log(`IP ${addr} - Tokens left: ${tokens - 1}`);
    await redis.set(key, tokens - 1);
  }
  return c.text("Hello Hono!");
});

// Token refill background job
setInterval(async () => {
  try {
    let cursor = "0";
    do {
      const { cursor: nextCursor, keys } = await redis.scan(cursor, {
        COUNT: 100,
      });
      cursor = nextCursor;

      for (const key of keys) {
        const val = await redis.get(key);
        if (!val) continue;

        const tokens = parseInt(val);
        const newTokens = Math.min(
          tokens + TOKENS_PER_INTERVAL,
          FULL_BUCKET_TOKEN_COUNT,
        );

        await redis.set(key, newTokens, { EX: EXPIRY_IN_SECONDS });
        console.log(`Updated tokens count to ${newTokens} for ${key}`);
      }
    } while (cursor !== "0");
  } catch (err) {
    console.error("Error refilling tokens:", err);
  }
}, TOKEN_REFILL_INTERVAL_MS);

export default app;
