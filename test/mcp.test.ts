import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { answerData, gatherSources } from "../src/commands/answer.js";
import { callTool, resolveRepo, TOOLS } from "../src/mcp/server.js";
import { installMcp, uninstallMcp } from "../src/mcp/install.js";
import { addItem } from "../src/plan/plan.js";
import { repoIdentity } from "../src/repo/identity.js";
import { openDb } from "../src/store/db.js";
import { ensureRepo, listLessons } from "../src/store/lessons.js";
import { indexSessions } from "../src/store/sessions.js";
import { fakeEmbed, tmp, useHome } from "./helpers.js";

let root = ""; let repo = "";
beforeEach(async () => {
  useHome(); root = join(tmp(), "shop"); mkdirSync(root); execFileSync("git", ["init", "-q", root]);
  repo = repoIdentity(root)!; await ensureRepo(await openDb(), repo, root);
});
const embed = async () => fakeEmbed;
async function seed() {
  const db = await openDb();
  await addItem(db, repo, "main", "decision", "Publish the package as secondnature, since muninn was taken on npm", { person: true });
  const file = join(tmp(), "log.jsonl"); writeFileSync(file, "x");
  await indexSessions(db, [{ id: "s1", tool: "claude-code", cwd: root, clientVersion: "1", unknown: 0, file, events: [
    { k: "typed", text: "the npm publish failed with EOTP", ts: "2026-11-20T13:55:00.000Z" },
    { k: "agent", text: "npm needs a one-time code from your authenticator app.", ts: "2026-11-20T13:55:10.000Z" },
  ] }], fakeEmbed);
  return db;
}

describe("answers from everything muninn keeps", () => {
  it("draws on plan decisions and past sessions, with dates, and passes earlier turns along", async () => {
    const db = await seed();
    const found = await gatherSources(db, "publish package secondnature npm", repo, fakeEmbed);
    expect(found.map((s) => s.kind)).toEqual(expect.arrayContaining(["decision", "session"]));
    expect(found.find((s) => s.kind === "session")!.date).toBe("2026-11-20");
    let prompt = "";
    const a = await answerData(db, "and why that name?", repo, { name: "fake", run: (p) => { prompt = p; return "Because muninn was taken [1]."; } }, fakeEmbed, [{ q: "what did we publish?", a: "secondnature [1]" }]);
    expect(a.answer).toBe("Because muninn was taken [1].");
    expect(prompt).toContain("EARLIER IN THIS CONVERSATION");
  });
});

describe("the MCP tools", () => {
  it("lists five tools, each with a schema", () => {
    expect(TOOLS.map((t) => t.name)).toEqual(["search_history", "get_plan", "get_week", "list_repos", "suggest_lesson"]);
    for (const t of TOOLS) expect(t.inputSchema.type).toBe("object");
  });
  it("finds a repo by its short name, and says which ones exist when it can't", async () => {
    const db = await openDb();
    expect(await resolveRepo(db, { repo: "SHOP" }, "/")).toBe(repo);
    await expect(resolveRepo(db, { repo: "nope" }, "/")).rejects.toThrow(/Known: shop/);
  });
  it("searches, shows the plan, and puts a suggested lesson in the review queue only", async () => {
    const db = await seed();
    const found = await callTool(db, "search_history", { query: "npm publish EOTP", repo: "shop" }, embed);
    expect(found).toContain("SESSION · shop");
    expect(found).toContain("one-time code");
    expect(await callTool(db, "get_plan", { repo: "shop", branch: "main" }, embed)).toContain("Publish the package as secondnature");
    expect(await callTool(db, "suggest_lesson", { text: "Run npm publish from a terminal so the code prompt works.", repo: "shop" }, embed)).toContain("Nothing reaches an agent until they keep it");
    expect((await listLessons(db, { repo, status: "proposed" })).map((l) => l.text)).toEqual(["Run npm publish from a terminal so the code prompt works."]);
    expect(await callTool(db, "list_repos", {}, embed)).toContain("shop");
  });
  it("speaks the protocol over stdin and stdout", async () => {
    const child = spawn(join(process.cwd(), "node_modules/.bin/tsx"), [join(process.cwd(), "src/cli.ts"), "mcp"], { env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    const lines: any[] = [];
    let buf = "";
    child.stdout.on("data", (d) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1); } });
    const send = (m: object) => child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\n");
    send({ id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } } });
    send({ method: "notifications/initialized" });
    send({ id: 2, method: "tools/list" });
    send({ id: 3, method: "tools/call", params: { name: "list_repos", arguments: {} } });
    await new Promise<void>((ok, fail) => { const t = setInterval(() => { if (lines.length >= 3) { clearInterval(t); ok(); } }, 50); setTimeout(() => { clearInterval(t); fail(new Error(`only ${lines.length} replies`)); }, 15000); });
    child.kill();
    expect(lines[0]).toMatchObject({ id: 1, result: { protocolVersion: "2025-06-18", serverInfo: { name: "muninn" } } });
    expect(lines[1].result.tools).toHaveLength(5);
    expect(lines[2].result.content[0].text).toContain("shop");
  }, 30000);
});

describe("adding the server to the Claude desktop app", () => {
  it("adds muninn beside the other servers, keeps a backup, and removes only its own", () => {
    const file = join(tmp(), "claude_desktop_config.json");
    process.env.MUNINN_DESKTOP_CONFIG = file;
    writeFileSync(file, JSON.stringify({ mcpServers: { other: { command: "x" } }, theme: "dark" }));
    try {
      expect(installMcp()).toEqual(["the Claude desktop app (restart it to pick this up)"]);
      const cfg = JSON.parse(readFileSync(file, "utf8"));
      expect(Object.keys(cfg.mcpServers)).toEqual(["other", "muninn"]);
      expect(cfg.mcpServers.muninn.args.at(-1)).toBe("mcp");
      expect(cfg.theme).toBe("dark");
      expect(JSON.parse(readFileSync(`${file}.muninn-backup`, "utf8")).mcpServers.muninn).toBeUndefined();
      uninstallMcp();
      expect(Object.keys(JSON.parse(readFileSync(file, "utf8")).mcpServers)).toEqual(["other"]);
    } finally { delete process.env.MUNINN_DESKTOP_CONFIG; }
  });
});

describe("which repo a question is about", () => {
  it("follows a repo the question names, over the one it was asked from", async () => {
    const { repoForQuestion } = await import("../src/commands/answer.js");
    const db = await openDb();
    await ensureRepo(db, "github.com/me/servanda", "/x");
    expect(await repoForQuestion(db, "What did I do in servanda this week?", repo)).toBe("github.com/me/servanda");
    expect(await repoForQuestion(db, "servanda and shop: what changed?", repo)).toBeNull();
    expect(await repoForQuestion(db, "what did we decide about npm?", repo)).toBe(repo);
  });
});
