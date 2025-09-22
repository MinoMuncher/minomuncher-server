import { downloadReplay, ioAuth } from "./io";
import { RateLimitedPromiseQueue } from "./promiseQueue";
import { parseReplay } from "minomuncher-core";
import { RateLimiterMemory } from "rate-limiter-flexible";

const SUPPORTER_IDS = (await Bun.file("supporters.txt").text()).split(/\s+/);

///important: USE A BOT ACCOUNT
const TETRIO_USERNAME = Bun.env.TETRIO_USERNAME;
const TETRIO_PASSWORD = Bun.env.TETRIO_PASSWORD;
const TETRIO_TOKEN = Bun.env.TETRIO_TOKEN;

if ((TETRIO_USERNAME === undefined || TETRIO_PASSWORD === undefined) && TETRIO_TOKEN === undefined) {
  throw Error(
    "missing env vars TETRIO_USERNAME and/or TETRIO_PASSWORD. REMEMBER TO USE A BOT ACCOUNT"
  );
}

const token = TETRIO_TOKEN
  ? TETRIO_TOKEN
  : await ioAuth(TETRIO_USERNAME!, TETRIO_PASSWORD!);
const queryQueue = new RateLimitedPromiseQueue(1000);
const rateLimiter = new RateLimiterMemory({
  points: 10, // 6 points
  duration: 3, // Per second
});

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for may contain multiple IPs, the first one is the real client
    const ip = forwardedFor.split(",")[0];
    if (ip) return ip.trim();
  }

  const conn = (req as any).conn; // Bun exposes a `conn` property
  if (conn && conn.remoteAddress) {
    return conn.remoteAddress;
  }

  return `${Math.random()}`;
}

const server = Bun.serve({
  port: Number.parseInt(Bun.env.MINOMUNCHER_PORT || "") || 3000,
  idleTimeout: 60,
  routes: {
    "/status": new Response("OK"),
    "/supporter/:token": (req) => {
      if (
        Bun.env.SUPPORTER_TOKEN &&
        Bun.env.SUPPORTER_TOKEN.length > 0 &&
        req.params.token == Bun.env.SUPPORTER_TOKEN
      ) {
        return new Response("OK");
      }
      return Response.json({ message: "invalid token" }, { status: 400 });
    },
    "/replay/:id": async (req) => {
      try {
        await rateLimiter.consume(getClientIp(req), 1);
      } catch (e) {
        return Response.json({ message: "rate limted" }, { status: 400 });
      }
      const id = req.params.id;
      let rep: string;
      try {
        rep = await queryQueue.enqueue(
          () => downloadReplay(id, token),
          validateReqSupporter(req)
        );
      } catch (e) {
        return Response.json(
          { message: "error downloading replay" },
          { status: 400 }
        );
      }
      try {
        const stats = parseReplay(rep);
        if (stats === undefined) throw Error();
        return Response.json(stats, { status: 200 });
      } catch (e) {
        return Response.json({ message: "error parsing" }, { status: 400 });
      }
    },
    "/replay": {
      GET: (_req) => {
        return Response.json(
          { message: "You need to make a post request to this endpoint" },
          { status: 400 }
        );
      },
      POST: async (req) => {
        try {
          await rateLimiter.consume(getClientIp(req), 1);
        } catch (e) {
          return Response.json({ message: "rate limted" }, { status: 400 });
        }
        try {
          const stats = parseReplay(await req.text());
          if (stats === undefined) throw Error();
          return Response.json(stats, { status: 200 });
        } catch (e) {
          return Response.json({ message: "error parsing" }, { status: 400 });
        }
      },
    },
    "/league/:id": async (req) => {
      try {
        await rateLimiter.consume(getClientIp(req), 1);
      } catch (e) {
        return Response.json({ message: "rate limted" }, { status: 400 });
      }
      const apiUrl = `https://ch.tetr.io/api/users/${req.params.id}/records/league/recent`;
      return queryPass(apiUrl, validateReqSupporter(req));
    },
    "/user/:username": async (req) => {
      try {
        await rateLimiter.consume(getClientIp(req), 1);
      } catch (e) {
        return Response.json({ message: "rate limted" }, { status: 400 });
      }
      const apiUrl = `https://ch.tetr.io/api/users/${req.params.username}`;
      return queryPass(apiUrl, validateReqSupporter(req));
    },
    "/discord/:id": async (req) => {
      try {
        await rateLimiter.consume(getClientIp(req), 1);
      } catch (e) {
        return Response.json({ message: "rate limted" }, { status: 400 });
      }
      const apiUrl = `https://ch.tetr.io/api/users/search/discord:id:${req.params.id}`;
      return queryPass(apiUrl, validateReqSupporter(req));
    },
    // Wildcard route for all routes that start with "/api/" and aren't otherwise matched
    "/api/*": Response.json({ message: "Not found" }, { status: 404 }),
  },
});

function validateReqSupporter<T extends string>(req: Bun.BunRequest<T>) {
  const supporter = req.headers.get("supporter");
  return SUPPORTER_IDS.includes(supporter ?? "") ||
    (Bun.env.SUPPORTER_TOKEN &&
      Bun.env.SUPPORTER_TOKEN.length > 0 &&
      supporter == Bun.env.SUPPORTER_TOKEN)
    ? 1
    : 0;
}

async function queryPass(apiUrl: string, prio: number) {
  try {
    const res = await queryQueue.enqueue(() => fetch(apiUrl), prio);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch from TETR.IO" }),
        { status: res.status, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

console.log(`Listening on http://localhost:${server.port}`);
