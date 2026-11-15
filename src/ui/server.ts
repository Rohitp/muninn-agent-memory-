import type { Client } from "@libsql/client";
import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { askData } from "../commands/ask.js";
import { reportData } from "../commands/report.js";
import { similar, suggestKeyword } from "../commands/review.js";
import { settings } from "../config.js";
import { syncCursor } from "../deliver/cursor.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { combine, decide, getLesson, keywordsInUse, listLessons } from "../store/lessons.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PAGE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "public", "index.html"), "utf8");

type Handler = (db: Client, q: URLSearchParams, body: any) => Promise<unknown>;

async function lessonDetail(db: Client, id: string) {
  const l = await getLesson(db, id);
  if (!l) return null;
  const evidence = (await db.execute({ sql: "SELECT tool,session,seen_at,quote FROM evidence WHERE lesson_id=? ORDER BY seen_at DESC LIMIT 20", args: [l.id] })).rows;
  const triggers = (await db.execute({ sql: "SELECT pattern FROM triggers WHERE lesson_id=?", args: [l.id] })).rows.map((r) => String(r.pattern));
  const sim = l.status === "proposed" ? await similar(db, l) : null;
  const suggested = l.suggested_keywords ? (JSON.parse(l.suggested_keywords) as string[]) : [suggestKeyword(l.text)].filter(Boolean);
  return { ...l, evidence, triggers, suggested, similar: sim ? { id: sim.lesson.id, text: sim.lesson.text, status: sim.lesson.status, score: sim.score } : null };
}

const routes: Record<string, Handler> = {
  "GET /api/repos": async (db) => (await db.execute("SELECT r.id, (SELECT count(*) FROM lessons l WHERE l.repo_id=r.id AND l.status='proposed') waiting, (SELECT count(*) FROM lessons l WHERE l.repo_id=r.id AND l.status='live') live FROM repos r ORDER BY live+waiting DESC, r.id")).rows,
  "GET /api/lessons": async (db, q) => {
    const repo = q.get("repo") || null; const status = q.get("status") || "proposed";
    const rows = await listLessons(db, { repo, status });
    const out = [];
    for (const l of rows.slice(0, 200)) out.push(await lessonDetail(db, l.id));
    return out;
  },
  "GET /api/keywords": async (db, q) => keywordsInUse(db, q.get("repo") || null),
  "POST /api/decide": async (db, _q, b) => {
    const id = String(b.id ?? "");
    if (!(await getLesson(db, id))) throw new Error("No lesson with that id.");
    if (b.action === "reject") await decide(db, id, { status: "rejected" });
    else if (b.action === "retire") await decide(db, id, { status: "retired" });
    else if (b.action === "keep" || b.action === "save") {
      const keywords = String(b.keywords ?? "").toLowerCase().split(",").map((k) => k.trim()).filter(Boolean);
      const route = String(b.route ?? "none");
      await decide(db, id, {
        ...(b.action === "keep" ? { status: "live" as const } : {}),
        ...(typeof b.text === "string" && b.text.trim() ? { text: b.text.trim() } : {}),
        ...(typeof b.news === "boolean" ? { news: b.news } : {}),
        ...(typeof b.global === "boolean" ? { global: b.global } : {}),
        alwaysOn: route === "always",
        triggers: route === "keyword" ? keywords : [],
      });
    } else if (b.action === "combine") {
      await combine(db, id, String(b.other ?? ""), typeof b.text === "string" && b.text.trim() ? b.text.trim() : undefined);
      await decide(db, id, { status: "live", alwaysOn: b.route === "always", triggers: b.route === "keyword" ? String(b.keywords ?? "").toLowerCase().split(",").map((k: string) => k.trim()).filter(Boolean) : [] });
    } else throw new Error("Unknown action.");
    await syncCursor(db);
    return lessonDetail(db, id);
  },
  "GET /api/report": async (db, q) => reportData(db, q.get("repo") || null),
  "GET /api/handoffs": async (db, q) => {
    const repo = q.get("repo");
    return (await db.execute({ sql: `SELECT id,repo_id,branch,tool,created_at,text FROM handoffs ${repo ? "WHERE repo_id=?" : ""} ORDER BY created_at DESC LIMIT 30`, args: repo ? [repo] : [] })).rows;
  },
  "GET /api/ask": async (db, q) => askData(db, q.get("q") ?? "", q.get("repo") || null),
  "GET /api/settings": async () => ({ maxPerDelivery: settings().maxPerDelivery }),
};

const readBody = (req: IncomingMessage) => new Promise<string>((ok, fail) => {
  let s = ""; req.setEncoding("utf8");
  req.on("data", (c) => { s += c; if (s.length > 1e6) { fail(new Error("Body too large")); req.destroy(); } });
  req.on("end", () => ok(s)); req.on("error", fail);
});
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * A local page for reviewing and editing lessons. Listens on 127.0.0.1 only, and every request needs
 * a random token from the URL muninn prints, so other web pages in the browser can't call it.
 */
export async function serve(args: string[]) {
  const db = await openDb();
  const token = randomBytes(18).toString("base64url");
  const here = repoIdentity(process.cwd());
  const portArg = args.indexOf("--port");
  const port = portArg >= 0 ? Number(args[portArg + 1]) : 4747;
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const send = (code: number, body: unknown, type = "application/json") => {
      res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" });
      res.end(type === "application/json" ? JSON.stringify(body) : String(body));
    };
    if (req.headers.host && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host)) return send(403, { error: "Wrong host." });
    if (req.method === "GET" && url.pathname === "/") {
      if (!same(url.searchParams.get("t") ?? "", token)) return send(403, "Open the link muninn printed in the terminal.", "text/plain");
      return send(200, PAGE.replace("__TOKEN__", token).replace("__REPO__", JSON.stringify(here)), "text/html; charset=utf-8");
    }
    if (!same(String(req.headers["x-muninn-token"] ?? ""), token)) return send(403, { error: "Missing token." });
    const h = routes[`${req.method} ${url.pathname}`];
    if (!h) return send(404, { error: "Not found." });
    try {
      const body = req.method === "POST" ? JSON.parse((await readBody(req)) || "{}") : {};
      send(200, await h(db, url.searchParams, body));
    } catch (e) { send(400, { error: e instanceof Error ? e.message : String(e) }); }
  });
  await new Promise<void>((ok) => {
    server.once("error", () => { server.listen(0, "127.0.0.1", ok); });
    server.listen(port, "127.0.0.1", ok);
  });
  const addr = server.address();
  const link = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : port}/?t=${token}`;
  console.log(`muninn is open at ${link}\nPress Ctrl+C to stop.`);
  if (!args.includes("--no-open") && process.platform === "darwin") spawn("open", [link], { stdio: "ignore", detached: true }).unref();
  else if (!args.includes("--no-open") && process.platform === "linux") spawn("xdg-open", [link], { stdio: "ignore", detached: true }).unref();
  await new Promise(() => { /* runs until Ctrl+C */ });
}
