import type { Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
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
  {
    name: "get_runs",
    description: "Autonomous work in a repo: workflow runs where agents worked together (subagents, an agent swarm, worktrees such as builder, reviewer and qa). For each run: time and tokens per role, commands and failures, approvals, work sent back, fixes made after approval, gaps where no agent worked, and the findings muninn wrote about it. Also whether each lesson kept for one role has worked since.",
    inputSchema: { type: "object", properties: { repo: repoArg, all_repos: { type: "boolean" }, limit: { type: "number", description: "How many recent runs; default 5." }, include_single: { type: "boolean", description: "Also runs with only one role (a plain session)." } } },
  },
  {
    name: "list_lessons",
    description: "The lessons muninn keeps for the engineer's coding agents in a repo: what agents are told and when (every session, on a keyword, or only when searched), why each was kept, which role it's for in a team of agents, and whether it has worked. Also the suggestions waiting for the engineer's review.",
    inputSchema: { type: "object", properties: { repo: repoArg, all_repos: { type: "boolean" }, waiting: { type: "boolean", description: "Only the suggestions waiting for review." } } },
  },
  {
    name: "where_left_off",
    description: "Where the last coding-agent session on a branch left off: what it was doing, what was done, and what's next. Use it when starting work, or when the engineer asks where things stand.",
    inputSchema: { type: "object", properties: { repo: repoArg, branch: { type: "string", description: "Branch name. Leave out for the branch checked out, else main." } } },
  },
  {
    name: "review_lesson",
    description: "Keep or dismiss a lesson waiting for the engineer's review, by the id list_lessons shows. Only when the engineer has said, in this chat, to keep or dismiss that specific lesson: never on your own judgement, and never for several lessons from one general instruction. Keeping makes agents be told it, with muninn's usual choice of when (every session, or on a keyword).",
    inputSchema: { type: "object", properties: {
      id: { type: "string", description: "The lesson's id or its first 8 characters, as list_lessons shows it." },
      action: { type: "string", enum: ["keep", "dismiss"] },
      engineer_said: { type: "string", description: "The engineer's own words in this chat asking for this, quoted." },
    }, required: ["id", "action", "engineer_said"] },
  },
] as const;

type Args = Record<string, unknown>;
/** The installed package's version, for the server's own info. */
function packageVersion(): string {
  try { return JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json"), "utf8")).version ?? "0"; } catch { return "0"; }
}
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
  if (name === "review_lesson") {
    const said = String(a.engineer_said ?? "").trim();
    if (said.length < 2) throw new Error("Quote what the engineer said asking for this. muninn changes what agents are told only when they ask.");
    const { getLesson, decide } = await import("../store/lessons.js");
    const l = await getLesson(db, String(a.id ?? "").trim());
    if (!l) throw new Error("No lesson with that id. list_lessons shows the ids.");
    if (l.status !== "proposed") throw new Error(`That lesson isn't waiting for review: it's ${l.status === "live" ? "already kept" : l.status}.`);
    if (a.action === "dismiss") { await decide(db, l.id, { status: "rejected" }); await db.execute({ sql: "INSERT INTO lesson_versions (id,lesson_id,snapshot,changed_by,changed_at) VALUES (lower(hex(randomblob(16))),?,?,?,?)", args: [l.id, JSON.stringify({ status: "rejected", said }), "mcp", new Date().toISOString()] }); return `Dismissed: "${l.text.slice(0, 120)}". muninn won't suggest it again.`; }
    if (a.action !== "keep") throw new Error("action is keep or dismiss.");
    const { defaultRoute } = await import("../commands/review.js");
    const d = defaultRoute(l);
    await decide(db, l.id, { status: "live", ...(d.route === "always" ? { alwaysOn: true } : {}), ...(d.route === "keyword" && d.keywords.length ? { triggers: d.keywords } : {}), ...(d.global ? { global: true } : {}) });
    await db.execute({ sql: "INSERT INTO lesson_versions (id,lesson_id,snapshot,changed_by,changed_at) VALUES (lower(hex(randomblob(16))),?,?,?,?)", args: [l.id, JSON.stringify({ status: "live", said }), "mcp", new Date().toISOString()] });
    try { const { syncCursor } = await import("../deliver/cursor.js"); await syncCursor(db); } catch { /* rules files are a convenience */ }
    const when = d.route === "always" ? "every session" : d.route === "keyword" && d.keywords.length ? `when "${d.keywords.join('", "')}" comes up` : "only when searched";
    return `Kept: "${l.text.slice(0, 120)}". Agents are told it ${when}${l.role ? `, the ${l.role} only` : ""}${d.global ? ", in every repo" : ""}. Change it in muninn ui.`;
  }
  if (name === "get_runs") return runsText(db, repo, { limit: typeof a.limit === "number" ? a.limit : 5, all: a.include_single === true });
  if (name === "list_lessons") return lessonsText(db, repo, a.waiting === true);
  if (name === "where_left_off") {
    if (!repo) throw new Error("Say which repo: the chat isn't running inside one.");
    const branch = typeof a.branch === "string" && a.branch ? a.branch : (currentBranch(process.cwd()) && repoIdentity(process.cwd()) === repo ? currentBranch(process.cwd())! : "main");
    const { latestHandoff, handoffText } = await import("../handoff/handoff.js");
    const { settings } = await import("../config.js");
    const h = await latestHandoff(db, repo, branch, 30);
    return h ? handoffText(h, settings().handoffStaleDays) : `No session on ${branch} in ${repo.split("/").pop()} has left a note in the last 30 days. Try get_plan for the branch's plan.`;
  }
  throw new Error(`No tool called ${name}.`);
}

const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
const short = (r: string) => r.split("/").pop() ?? r;

/** Recent runs with their numbers per role, saved findings, and how role lessons are doing. */
export async function runsText(db: Client, repo: string | null, o: { limit: number; all: boolean }): Promise<string> {
  const { listRuns } = await import("../workflow/runs.js");
  const { runNumbers, savedFindings } = await import("../commands/run-findings.js");
  const { roleEffects } = await import("../workflow/effect.js");
  const runs = await listRuns(db, { repo, teamOnly: !o.all, limit: Math.max(1, Math.min(o.limit, 20)) });
  const found = await savedFindings(db, runs);
  const out: string[] = [];
  for (const r of runs) {
    const n = runNumbers(r);
    out.push(`RUN ${r.started_at.slice(0, 16).replace("T", " ")}${repo ? "" : ` · ${short(r.repo_id)}`} · ${n.minutes} min · ${k(n.tokens)} tokens · roles: ${r.roles.join(", ")}${n.typed ? ` · the engineer typed ${n.typed} message(s)` : " · ran on its own"}`);
    const { dollars } = await import("../workflow/runs.js");
    const costOfRole = (role: string) => dollars(r.sessions.filter((x) => x.role === role).map((x) => ({ ...x, cost_usd: x.cost_usd ?? null })));
    for (const x of n.roles) out.push(`- ${x.role}: ${x.sessions} session(s), ${Math.round(x.minutes)} min, ${k(x.tokens)} tokens (${Math.round(x.share * 100)}%)${costOfRole(x.role) ? `, ${costOfRole(x.role)}` : ""}, ${x.commands} command(s)${x.failed ? `, ${x.failed} failed` : ""}${x.approvals ? `, ${x.approvals} approval(s)` : ""}${x.sentBack ? `, work sent back to it ${x.sentBack} time(s)` : ""}`);
    out.push(`Between roles: ${n.approvals} approval(s), ${n.sentBack} sent back, ${n.rework} fix(es) after approval${n.stalls.length ? `, ${n.stalls.length} gap(s) of ${n.stalls.map((g) => `${g.minutes} min`).join(", ")} with no agent working` : ""}.`);
    for (const h of r.handoffs.filter((h) => h.kind === "review_rejected" || h.kind === "rework").slice(0, 6)) out.push(`  ${h.at.slice(11, 16)} ${h.kind === "rework" ? `${h.from_role} fixed later` : `${h.from_role} sent back to ${h.to_role}`}: ${h.note ?? h.evidence ?? ""}`);
    for (const w of r.workflows ?? []) out.push(`Workflow ${w.name} (${w.status}): ${w.agents} agents, phases ${w.phases.join(" → ")}${w.logs.length ? `; ${w.logs.slice(-3).join("; ")}` : ""}${w.blocking_left ? `. Finished with ${w.blocking_left} blocking issue(s) still open.` : ""}`);
    const f = found[r.id];
    if (f?.items.length) { out.push("Findings:"); for (const i of f.items) out.push(`  - ${i.role ? `[${i.role}] ` : ""}${i.text}`); }
    out.push("");
  }
  const effects = await roleEffects(db, repo);
  if (effects.length) { out.push("LESSONS FOR ONE ROLE, AND WHETHER THEY WORKED:"); for (const e of effects) out.push(`- for the ${e.role}${repo ? "" : ` (${short(e.repo)})`}: ${e.text.slice(0, 160)}\n  ${e.summary}`); }
  if (!runs.length && !effects.length) return `No workflow runs${repo ? ` in ${short(repo)}` : ""} yet${o.all ? "" : " with more than one role (subagents, or agents in different worktrees). Set include_single for plain sessions"}. muninn builds runs when it scans.`;
  return out.join("\n").trim();
}

/** Kept lessons and waiting suggestions, with how each is told, why it was kept, its role, and how it's doing. */
export async function lessonsText(db: Client, repo: string | null, waitingOnly: boolean): Promise<string> {
  const { reportData } = await import("../commands/report.js");
  const { roleEffects } = await import("../workflow/effect.js");
  const where = repo ? "AND (l.repo_id=? OR l.scope='global')" : "";
  const rows = (await db.execute({ sql: `SELECT l.id,l.text,l.status,l.always_on,l.role,l.why,l.scope,l.repo_id,(SELECT group_concat(pattern, ', ') FROM triggers t WHERE t.lesson_id=l.id) kw FROM lessons l WHERE l.off=0 AND l.status IN (${waitingOnly ? "'proposed'" : "'live','proposed'"}) ${where} ORDER BY l.status DESC, l.updated_at DESC LIMIT 60`, args: repo ? [repo] : [] })).rows;
  if (!rows.length) return waitingOnly ? "No suggestions are waiting." : `No lessons${repo ? ` for ${short(repo)}` : ""} yet.`;
  const verdict = new Map((await reportData(db, repo)).lessons.map((l) => [l.id, l.verdict]));
  for (const e of await roleEffects(db, repo)) verdict.set(e.id, e.summary);
  const line = (r: Record<string, unknown>) => {
    const when = r.status === "proposed" ? "waiting for review" : r.always_on ? "told every session" : r.kw ? `told when "${r.kw}" comes up` : "only when searched";
    const where = r.scope === "global" ? "every repo" : repo ? null : short(String(r.repo_id));
    return `- [${String(r.id).slice(0, 8)}] ${String(r.text).slice(0, 400)}\n  (${[when, r.role ? `for the ${r.role} only` : null, where].filter(Boolean).join(", ")})${r.why ? `\n  Why: ${r.why}` : ""}${verdict.get(String(r.id)) ? `\n  How it's doing: ${verdict.get(String(r.id))}` : ""}`;
  };
  const kept = rows.filter((r) => r.status === "live"), waiting = rows.filter((r) => r.status === "proposed");
  return [kept.length ? `KEPT (${kept.length}):\n${kept.map(line).join("\n")}` : "", waiting.length ? `WAITING FOR REVIEW (${waiting.length}):\n${waiting.map(line).join("\n")}` : ""].filter(Boolean).join("\n\n");
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
        reply({ protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: {} }, serverInfo: { name: "muninn", title: "muninn (secondnature)", version: packageVersion() },
          instructions: "muninn keeps the engineer's coding history: lessons, branch plans, past agent sessions, and autonomous runs where agents worked together. Search it before answering questions about past work, check where_left_off when starting work on a branch, use get_runs for how agent teams did, and suggest a lesson when they ask for something to be remembered." });
      } else if (m.method === "ping") reply({});
      else if (m.method === "tools/list") reply({ tools: TOOLS });
      else if (m.method === "tools/call") {
        try { reply({ content: [{ type: "text", text: await callTool(db, String(m.params?.name), m.params?.arguments ?? {}, embed) }] }); }
        catch (e) { reply({ content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true }); }
      } else send({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: `Unknown method ${m.method}` } });
    } catch (e) { send({ jsonrpc: "2.0", id: m.id, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } }); }
  }
}
