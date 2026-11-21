import type { Client } from "@libsql/client";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { effortMoments } from "../learn/signals.js";
import { spanOf, type Session } from "../logs/types.js";

/**
 * A workflow run: sessions in one repo that worked at the same time or one after another, with each one's role.
 * A software factory's builder, reviewer and qa worktrees make one run with three roles; so do a session and the
 * subagents it started. A plain session on its own is a run with one role, "main".
 */
export type RunSession = {
  id: string; tool: string; role: string; branch: string | null; worktree: string | null; parent_session: string | null; agent_type: string | null;
  started_at: string; ended_at: string; tokens_in: number; tokens_out: number; cache_read: number; model: string | null;
  commands: number; failed_commands: number; task: string | null;
  /** Messages the engineer typed: 0 for a session that ran on its own. */
  typed: number;
};
export type Handoff = {
  from_role: string; to_role: string; at: string; kind: "handoff" | "review_rejected" | "approved" | "rework"; note?: string;
  /** A short quote or file path showing what was handed over: the message, the task the next role was given, or the last file the previous role changed. */
  evidence?: string;
};
export type Run = {
  id: string; repo_id: string; started_at: string; ended_at: string; roles: string[]; team: boolean;
  sessions: RunSession[]; handoffs: Handoff[];
  /** Times work went back to a role it had already left (builder → reviewer → builder is one). */
  bounces: number;
  /** Output tokens spent on failed retries, loops and re-reads. */
  wasted_tokens: number;
  tokens_in: number; tokens_out: number;
};

/** Sessions this far apart in time are separate runs. */
export const RUN_GAP_MS = 30 * 60_000;

const worktrees = new Map<string, string | null>();
/** The linked git worktree a folder is in ("builder" for .worktrees/builder), or null for the repo's main folder. */
export function worktreeOf(cwd: string): string | null {
  if (!cwd) return null;
  if (worktrees.has(cwd)) return worktrees.get(cwd)!;
  let name: string | null = null;
  try {
    const [dir, common, top] = execFileSync("git", ["-C", cwd, "rev-parse", "--git-dir", "--git-common-dir", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).trim().split("\n");
    // In a linked worktree, its own git folder differs from the one all worktrees share.
    if (dir && common && dir !== common && !dir.endsWith(common)) name = basename(top ?? cwd);
  } catch {
    name = cwd.match(/\/(?:\.worktrees|\.claude\/worktrees|worktrees)\/([^/]+)/)?.[1] ?? null;
  }
  worktrees.set(cwd, name);
  return name;
}
/** A session's role: a subagent's type, else the worktree it ran in, else "main". */
export const roleOf = (s: Session) => s.parent ? (s.agentType ?? worktreeOf(s.cwd) ?? "subagent") : worktreeOf(s.cwd) ?? "main";

/** A reviewer, checker or qa role sending work back. Read from what that role's agent said. */
export const REJECTS = /\b(changes requested|request(ed|ing)? changes|--request-changes|not (approved|ready to merge|ready)|(do not|don'?t|cannot|can'?t) (approve|merge)|reject(ed|ing)?\b|blocking (issue|problem)s?|fails? (the )?(acceptance|review|check)|needs? (more )?work|send(ing)? (it )?back)/i;
export const REVIEWER = /review|check|qa|test|verif|audit|critic/i;

/** A slice of a session: what it did between two times. A session left open for days is several slices. */
type Slice = { s: Session; start: string; end: string };
const inSlice = (ts: string, from: string, to: string) => ts >= from && ts <= to;
/** A session cut into bursts of activity: a quiet gap longer than RUN_GAP_MS ends a burst. */
function bursts(s: Session): Slice[] {
  const ts = s.events.map((e) => e.ts).concat((s.turns ?? []).map((t) => t.ts)).filter(Boolean).sort();
  const out: Slice[] = [];
  for (const t of ts) {
    const cur = out.at(-1);
    if (cur && Date.parse(t) - Date.parse(cur.end) <= RUN_GAP_MS) cur.end = t; else out.push({ s, start: t, end: t });
  }
  return out;
}
/** A session limited to a slice of time. */
const sliceOf = (s: Session, from: string, to: string): Session => ({
  ...s, events: s.events.filter((e) => inSlice(e.ts, from, to)), turns: (s.turns ?? []).filter((t) => inSlice(t.ts, from, to)),
});

function toRunSession(s: Session): RunSession {
  const { start, end } = spanOf(s);
  const cmds = s.events.filter((e) => e.k === "cmd");
  const turns = s.turns ?? [];
  const t0 = [start, turns[0]?.ts].filter(Boolean).sort()[0] ?? "";
  const t1 = [end, turns.at(-1)?.ts].filter(Boolean).sort().at(-1) ?? "";
  return {
    id: s.id, tool: s.tool, role: roleOf(s), branch: s.branch ?? null, worktree: s.parent ? null : worktreeOf(s.cwd), parent_session: s.parent ?? null, agent_type: s.agentType ?? null,
    started_at: t0, ended_at: t1, tokens_in: turns.reduce((n, t) => n + t.input, 0), tokens_out: turns.reduce((n, t) => n + t.output, 0), cache_read: 0, model: s.model ?? null,
    commands: cmds.length, failed_commands: cmds.filter((e) => e.k === "cmd" && e.failed).length, task: s.task?.slice(0, 300) ?? null,
    typed: s.events.filter((e) => e.k === "typed").length,
  };
}

/**
 * Groups a repo's sessions into runs. Each session is cut into bursts of activity; bursts in different sessions that
 * overlap or follow within RUN_GAP_MS make one run, and a subagent joins the run its parent was in when it started.
 * Pure: no database.
 */
export function buildRuns(repo: string, sessions: Session[]): Run[] {
  const slices = sessions.flatMap(bursts).sort((a, b) => a.start.localeCompare(b.start));
  const groups: Slice[][] = [];
  let end = 0;
  for (const x of slices) {
    if (!groups.length || Date.parse(x.start) - end > RUN_GAP_MS) { groups.push([]); end = 0; }
    groups.at(-1)!.push(x);
    end = Math.max(end, Date.parse(x.end));
  }
  return groups.map((g) => {
    const from = g[0]!.start, to = g.map((x) => x.end).sort().at(-1)!;
    const all: Session[] = [];
    for (const x of g) {
      all.push(sliceOf(x.s, x.start, x.end));
      for (const sub of x.s.subagents ?? []) { const st = spanOf(sub).start || sub.turns?.[0]?.ts || ""; if (st && inSlice(st, x.start, new Date(Date.parse(x.end) + RUN_GAP_MS).toISOString())) all.push(sub); }
    }
    const rs = all.map(toRunSession).filter((r) => r.started_at && (r.tokens_out || r.commands || r.parent_session || r.ended_at > r.started_at)).sort((a, b) => a.started_at.localeCompare(b.started_at));
    const roles = [...new Set(rs.map((r) => r.role))];
    // Handoffs: a role starting work after another role's session or subagent started. A return to a role is a bounce.
    const handoffs: Handoff[] = []; let bounces = 0; const seen: string[] = [];
    const swarm = all.some((x) => x.messages?.some((m) => m.dir === "out"));
    for (const r of swarm ? [] : rs) {
      if (r.role === "main" && r.parent_session === null && seen.length) continue; // the session steering the run isn't a step in it
      const prev = seen.at(-1);
      if (prev && prev !== r.role) {
        const before = all.find((x) => roleOf(x) === prev);
        const lastFile = before ? [...before.events].reverse().find((e) => e.k === "file" && e.tool !== "read") as { path: string } | undefined : undefined;
        handoffs.push({ from_role: prev, to_role: r.role, at: r.started_at, kind: "handoff", evidence: (r.task ?? lastFile?.path ?? "").replace(/\s+/g, " ").slice(0, 200) || undefined });
        if (seen.includes(r.role)) bounces++;
      }
      seen.push(r.role);
    }
    // A reviewing role that said the work isn't ready sent it back.
    for (const s of all) {
      const role = roleOf(s);
      if (!REVIEWER.test(role)) continue;
      const said = s.events.find((e) => e.k === "agent" && REJECTS.test(e.text)) as { text: string; ts: string } | undefined;
      if (said) {
        const at = said.text.search(REJECTS);
        handoffs.push({ from_role: role, to_role: roles.find((x) => x !== role && x !== "main" && !REVIEWER.test(x)) ?? "main", at: said.ts, kind: "review_rejected", note: said.text.match(REJECTS)?.[0], evidence: said.text.slice(Math.max(0, at - 60), at + 140).replace(/\s+/g, " ") });
      }
    }
    // Swarm agents say who they're handing to: a board message mentioning @roles. Approvals, send-backs and follow-up fixes are read from it.
    for (const x of all) for (const m of x.messages ?? []) {
      if (m.dir !== "out") continue;
      const from = roleOf(x);
      const to = m.to.filter((r) => r !== from && r !== "coordinator");
      const kind: Handoff["kind"] = /\bAPPROVE[D]?\b|LGTM|\[approved?\]|\b(QA|CHECK|ACCEPTANCE|TESTS?) PASS(ED)?\b/i.test(m.text) && !/\bnot approved?\b/i.test(m.text) ? "approved" : REJECTS.test(m.text) || /\[blocked\]/i.test(m.text) ? "review_rejected" : /follow-?up/i.test(m.text) ? "rework" : "handoff";
      handoffs.push({ from_role: from, to_role: to.length > 2 ? "everyone" : to.join(", ") || "board", at: m.ts, kind, note: (kind === "rework" ? m.text.split("\n").find((l) => /follow-?up/i.test(l)) ?? m.text : m.text).replace(/^["\s]+/, "").replace(/(@[\w-]+\s*)+/, "").replace(/\s+/g, " ").slice(0, 160), evidence: m.text.replace(/^["\s]+/, "").replace(/(@[\w-]+\s*)+/, "").replace(/\s+/g, " ").slice(0, 200) });
    }
    handoffs.sort((a, b) => a.at.localeCompare(b.at));
    const wasted = effortMoments(all).reduce((n, m) => n + (m.wasted ?? 0), 0);
    return {
      id: createHash("sha1").update(`${repo}\u0000${from}`).digest("hex").slice(0, 16), repo_id: repo,
      started_at: from, ended_at: [to, ...rs.map((r) => r.ended_at)].sort().at(-1)!, roles, team: roles.length > 1, sessions: rs, handoffs, bounces,
      wasted_tokens: wasted, tokens_in: rs.reduce((n, r) => n + r.tokens_in, 0), tokens_out: rs.reduce((n, r) => n + r.tokens_out, 0),
    };
  });
}

/** Stores a repo's runs, replacing earlier versions of the same runs. */
export async function saveRuns(db: Client, runs: Run[]) {
  for (const r of runs) await db.execute({ sql: "INSERT OR REPLACE INTO runs (id,repo_id,started_at,ended_at,team,data) VALUES (?,?,?,?,?,?)", args: [r.id, r.repo_id, r.started_at, r.ended_at, r.team ? 1 : 0, JSON.stringify(r)] });
}
/** Recent runs, newest first. Takes a repo (null for all repos) or options. */
export async function listRuns(db: Client, o: { repo?: string | null; teamOnly?: boolean; limit?: number } | string | null = {}): Promise<Run[]> {
  const opts = typeof o === "string" || o === null ? { repo: o } : o;
  const where = [opts.repo ? "repo_id=?" : "1", opts.teamOnly ? "team=1" : "1"].join(" AND ");
  const rows = (await db.execute({ sql: `SELECT data FROM runs WHERE ${where} ORDER BY started_at DESC LIMIT ?`, args: [...(opts.repo ? [opts.repo] : []), opts.limit ?? 50] })).rows;
  return rows.map((r) => JSON.parse(String(r.data)) as Run);
}

/** muninn runs: recent workflow runs in this repo (or all repos), most recent first. */
export async function runsCmd(db: Client, repo: string | null, opts: { all?: boolean } = {}) {
  const runs = await listRuns(db, { repo, teamOnly: !opts.all, limit: 15 });
  if (!runs.length) { console.log(opts.all ? "No runs yet. muninn groups sessions into runs when it scans." : "No runs with more than one role yet: a run needs subagents, or sessions in different worktrees. \"muninn runs --all\" shows single sessions too."); return; }
  const k = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
  for (const r of runs) {
    const mins = Math.round((Date.parse(r.ended_at) - Date.parse(r.started_at)) / 60_000);
    console.log(`\n${r.started_at.slice(0, 16).replace("T", " ")}  ${repo ? "" : r.repo_id + "  "}${mins} min, ${r.sessions.length} session(s), roles: ${r.roles.join(", ")}`);
    console.log(`  tokens: ${k(r.tokens_in)} in, ${k(r.tokens_out)} out${r.wasted_tokens ? `, ${k(r.wasted_tokens)} on failed retries and re-reads` : ""}${r.bounces ? `, ${r.bounces} bounce(s) back to an earlier role` : ""}`);
    const byRole = new Map<string, RunSession[]>();
    for (const s of r.sessions) byRole.set(s.role, [...(byRole.get(s.role) ?? []), s]);
    for (const [role, ss] of byRole) {
      const out = ss.reduce((n, s) => n + s.tokens_out, 0), cmds = ss.reduce((n, s) => n + s.commands, 0), failed = ss.reduce((n, s) => n + s.failed_commands, 0);
      console.log(`  ${role.padEnd(18)} ${ss.length} session(s), ${k(out)} tokens out, ${cmds} command(s)${failed ? `, ${failed} failed` : ""}`);
    }
    const n = (k: Handoff["kind"]) => r.handoffs.filter((h) => h.kind === k).length;
    if (r.handoffs.length) console.log(`  between roles: ${n("handoff")} handoff(s), ${n("approved")} approval(s), ${n("review_rejected")} sent back, ${n("rework")} follow-up fix(es)`);
    for (const h of r.handoffs.filter((h) => h.kind === "review_rejected" || h.kind === "rework"))
      console.log(`  ${h.at.slice(11, 16)} ${h.from_role} ${h.kind === "rework" ? "fixed something raised earlier" : `sent work back to ${h.to_role}`}${h.note ? `: "${h.note.slice(0, 110)}"` : ""}`);
  }
}
