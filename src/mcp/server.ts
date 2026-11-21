import type { Client } from "@libsql/client";
import { createInterface } from "node:readline";
import { gatherSources } from "../commands/answer.js";
import { insightsData, insightsText } from "../commands/insights.js";
import { loadEmbedder, modelCached, type Embed } from "../embed/model.js";
import { currentBranch } from "../handoff/handoff.js";
import { getPlan, planMarkdown } from "../plan/plan.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { createLesson } from "../store/lessons.js";

/**
 * muninn as an MCP server, so you can ask about your own work from any chat with Claude (the desktop app,
 * Claude Code, Cursor): what was decided, what was done, how something was solved before. It reads what muninn
 * keeps; the one thing it writes is a suggested lesson, which waits for your review like any other.
 */
const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const repoArg = { type: "string", description: "A repo's name as muninn lists it (for example \"servanda\"). Leave out for the repo the chat is running in, if any, else all repos." };
export const TOOLS = [
  {
    name: "search_history",
    description: "Search everything muninn keeps about the engineer's coding work: kept lessons and notes, branch plan decisions and finished work, and exchanges from past coding-agent sessions (what they asked, what the agent said and ran). Finds by meaning and by words. Use it to answer questions like \"why did we rename the package?\", \"how did we fix the webhook last time?\" or \"what did I work on in servanda?\". Cite what you use, with its date.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "What to look for, in plain words." }, repo: repoArg, all_repos: { type: "boolean", description: "Search every repo." } }, required: ["query"] },
  },
  {
    name: "get_plan",
    description: "A branch's plan as muninn keeps it from the engineer's sessions: the goal, where it stands, what's next, decisions with dates, and what's done.",
    inputSchema: { type: "object", properties: { repo: repoArg, branch: { type: "string", description: "Branch name. Leave out for the branch checked out, else main." } } },
  },
  {
    name: "get_week",
    description: "The engineer's recent days with coding agents: sessions, where effort was wasted (loops, failures, wrong paths), whether kept lessons helped, and what's waiting for review.",
    inputSchema: { type: "object", properties: { repo: repoArg, all_repos: { type: "boolean" }, days: { type: "number", description: "How many days back; default 7." } } },
  },
  {
    name: "get_related",
    description: "What a decision or piece of finished work connects to in the engineer's history: the outcomes a decision led to, the decisions behind an outcome, the sessions it was discussed and built in, the commits it shipped in, and the files those sessions worked on. Use it for questions like \"what did deciding X affect?\" or \"why was Y built?\", then check the code itself for what is affected today.",
    inputSchema: { type: "object", properties: { about: { type: "string", description: "The decision or work, in plain words." }, repo: repoArg, all_repos: { type: "boolean" } }, required: ["about"] },
  },
  {
    name: "list_repos",
    description: "The repos muninn knows, with how many lessons each has kept and waiting.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "suggest_lesson",
    description: "Suggest a lesson for the engineer's coding agents, when they say something should be remembered (\"remember that…\", \"agents should always…\"). It goes into muninn's review queue; nothing reaches an agent until the engineer keeps it. Write it as an instruction to an agent, in one or two plain sentences.",
    inputSchema: { type: "object", properties: { text: { type: "string" }, repo: repoArg, everywhere: { type: "boolean", description: "True if it applies in every repo, like how to explain things." } }, required: ["text"] },
  },
] as const;

type Args = Record<string, unknown>;
/** The repo a call means: one named (full id or the short name muninn shows), else the chat's own folder, else none. */
export async function resolveRepo(db: Client, a: Args, cwd = process.cwd()): Promise<string | null> {
  if (a.all_repos === true) return null;
  const named = typeof a.repo === "string" ? a.repo.trim() : "";
  if (named) {
    const ids = (await db.execute("SELECT id FROM repos")).rows.map((r) => String(r.id));
    const hit = ids.find((id) => id === named || id.split("/").filter(Boolean).pop()?.toLowerCase() === named.toLowerCase());
    if (!hit) throw new Error(`muninn doesn't know a repo called "${named}". Known: ${ids.map((i) => i.split("/").pop()).join(", ")}.`);
    return hit;
  }
  return repoIdentity(cwd);
}

export async function callTool(db: Client, name: string, a: Args, embed: () => Promise<Embed | null>): Promise<string> {
  if (name === "list_repos") {
    const rows = (await db.execute("SELECT r.id, (SELECT count(*) FROM lessons l WHERE l.repo_id=r.id AND l.status='live') kept, (SELECT count(*) FROM lessons l WHERE l.repo_id=r.id AND l.status='proposed') waiting, (SELECT count(DISTINCT session) FROM chunks c WHERE c.repo_id=r.id AND c.tool!='plan') sessions FROM repos r ORDER BY r.id")).rows;
    return rows.map((r) => `${String(r.id).split("/").pop()} (${r.id}): ${r.kept} kept lesson(s), ${r.waiting} waiting, ${r.sessions} stored session(s)`).join("\n") || "muninn doesn't know any repos yet.";
  }
  const repo = await resolveRepo(db, a);
  if (name === "search_history") {
    const q = String(a.query ?? "").trim();
    if (!q) throw new Error("Give a query.");
    const e = await embed();
    if (!e) throw new Error("muninn's local model isn't downloaded yet. Run \"muninn learn --all-repos\" once in a terminal.");
    const found = await gatherSources(db, q, repo, e, { limit: 10 });
    if (!found.length) return `Nothing muninn keeps${repo ? ` for ${repo.split("/").pop()}` : ""} matches "${q}".${repo ? " Try all_repos." : ""}`;
    return found.map((s) => `[${s.n}] ${s.kind.toUpperCase()} · ${s.where}${s.date ? ` · ${s.date}` : ""}\n${s.text.slice(0, 1500)}`).join("\n\n");
  }
  if (name === "get_plan") {
    if (!repo) throw new Error("Say which repo: the chat isn't running inside one.");
    const branch = typeof a.branch === "string" && a.branch ? a.branch : (currentBranch(process.cwd()) && repoIdentity(process.cwd()) === repo ? currentBranch(process.cwd())! : "main");
    return planMarkdown(await getPlan(db, repo, branch), repo.split("/").pop() ?? repo, branch);
  }
  if (name === "get_related") {
    const e = await embed();
    if (!e) throw new Error("muninn's local model isn't downloaded yet. Run \"muninn learn --all-repos\" once in a terminal.");
    const { relatedText } = await import("../links/links.js");
    return relatedText(db, String(a.about ?? ""), repo, e);
  }
  if (name === "get_week") return insightsText(await insightsData(db, repo, typeof a.days === "number" ? a.days : 7));
  if (name === "suggest_lesson") {
    const text = String(a.text ?? "").trim();
    if (text.length < 8) throw new Error("Write the lesson as a sentence or two.");
    const global = a.everywhere === true;
    if (!repo && !global) throw new Error("Say which repo it's for, or set everywhere.");
    const id = await createLesson(db, { repo_id: global ? null : repo, scope: global ? "global" : "repo", text: text.slice(0, 1000), source: "own_words", status: "proposed", suggestedScope: global ? "global" : "repo", by: "mcp" });
    return `Added to the engineer's suggestions (${id.slice(0, 8)}). Nothing reaches an agent until they keep it in muninn ui or with "muninn review".`;
  }
  throw new Error(`No tool called ${name}.`);
}

type Msg = { jsonrpc: "2.0"; id?: number | string | null; method?: string; params?: any };
/** Runs the server on stdin and stdout, one JSON-RPC message per line. Logs go to stderr only. */
export async function serveMcp() {
  const db = await openDb();
  let embedder: Promise<Embed | null> | null = null;
  const embed = () => (embedder ??= modelCached() ? loadEmbedder() : Promise.resolve(null));
  const send = (m: object) => process.stdout.write(JSON.stringify(m) + "\n");
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let m: Msg;
    try { m = JSON.parse(line); } catch { send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); continue; }
    if (m.id === undefined) continue; // a notification, such as notifications/initialized
    const reply = (result: object) => send({ jsonrpc: "2.0", id: m.id, result });
    try {
      if (m.method === "initialize") {
        const asked = String(m.params?.protocolVersion ?? "");
        reply({ protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: {} }, serverInfo: { name: "muninn", title: "muninn (secondnature)", version: "0.1" },
          instructions: "muninn keeps the engineer's coding history: lessons, branch plans and past agent sessions. Search it before answering questions about past work, and suggest a lesson when they ask for something to be remembered." });
      } else if (m.method === "ping") reply({});
      else if (m.method === "tools/list") reply({ tools: TOOLS });
      else if (m.method === "tools/call") {
        try { reply({ content: [{ type: "text", text: await callTool(db, String(m.params?.name), m.params?.arguments ?? {}, embed) }] }); }
        catch (e) { reply({ content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true }); }
      } else send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: `Unknown method ${m.method}` } });
    } catch (e) { send({ jsonrpc: "2.0", id: m.id, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } }); }
  }
}
