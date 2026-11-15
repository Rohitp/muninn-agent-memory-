import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { isPaused, settings } from "../config.js";
import { repoIdentity } from "../repo/identity.js";
import { currentBranch, handoffText, latestHandoff } from "../handoff/handoff.js";
import { getDial } from "../store/dial.js";

export type HookInput = { hook_event_name?: string; session_id?: string; cwd?: string; source?: string; prompt?: string; tool_input?: { command?: string }; tool_response?: unknown; error?: string; transcript_path?: string | null; [k: string]: unknown };
type Row = { id: string; text: string; always_on: number; updated_at: string; pattern: string | null };
const tokens = (t: string) => Math.ceil(t.length / 4);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Case-insensitive literal match on word boundaries. */
export const matches = (pattern: string, text: string) => new RegExp(`(^|\\W)${escape(pattern.toLowerCase())}(\\W|$)`).test(text.toLowerCase());

/** Cursor runs Claude Code hooks it imports, and its input carries fields Claude Code's doesn't. */
export const fromCursor = (i: HookInput) => "conversation_id" in i || "workspace_roots" in i || "cursor_version" in i;

/**
 * Codex sends PostToolUse for every Bash call, including failed ones, and doesn't document the result's shape.
 * Treats it as failed when an exit code other than 0 shows up as a field or in the text.
 */
export function codexFailed(resp: unknown): boolean {
  if (resp == null) return false;
  if (typeof resp === "object") {
    const r = resp as Record<string, unknown>;
    for (const k of ["exit_code", "exitCode", "status_code"]) if (typeof r[k] === "number") return r[k] !== 0;
    if (r.success === false || r.is_error === true) return true;
    return codexFailed(r.output ?? r.stdout ?? r.content ?? JSON.stringify(r));
  }
  const m = String(resp).match(/(?:exit code|exited with code|Process exited with code)[:\s]*(-?\d+)/i);
  return !!m && Number(m[1]) !== 0;
}
const responseText = (r: unknown) => (typeof r === "string" ? r : JSON.stringify(r ?? "")).slice(-2000);

/** Picks lessons for a hook event, applies the limits, logs every outcome, and returns the text to add, if any. */
export async function deliver(db: Client, client: string, input: HookInput): Promise<string | null> {
  const event = input.hook_event_name ?? "";
  const session = input.session_id ?? null;
  const ts = new Date().toISOString();
  // trigger_id holds the keyword that matched, so the panel can say why a lesson was sent.
  const log = (outcome: string, l?: { id: string; pattern?: string | null }, t = 0) =>
    db.execute({ sql: "INSERT INTO deliveries (id,ts,tool,session,event,source,lesson_id,outcome,tokens,trigger_id) VALUES (?,?,?,?,?,?,?,?,?,?)", args: [randomUUID(), ts, client, session, event, input.source ?? null, l?.id ?? null, outcome, t, l?.pattern ?? null] });
  if (fromCursor(input)) { await log("unsupported_client"); return null; }
  if (isPaused()) { await log("paused"); return null; }
  const repo = input.cwd ? repoIdentity(input.cwd) : null;
  // The dial: quiet holds everything back; "start" speaks only when a session starts, never mid-task.
  const dial = await getDial(db, repo);
  const midTask = event === "UserPromptSubmit" || event.startsWith("PostToolUse");
  if (dial === "quiet" || (dial === "start" && midTask)) { await log("paused"); return null; }
  // Switched-off lessons stay kept but are never told.
  const scope = "l.status='live' AND l.off=0 AND (l.scope='global' OR l.repo_id IS ? OR l.repo_id=?)";
  let rows: Row[] = [];
  if (event === "SessionStart" || event === "SubagentStart") {
    rows = (await db.execute({ sql: `SELECT l.id,l.text,l.always_on,l.updated_at,NULL pattern FROM lessons l WHERE ${scope} AND l.always_on=1`, args: [repo, repo] })).rows as unknown as Row[];
  } else if (event === "UserPromptSubmit" || event === "PostToolUseFailure" || (event === "PostToolUse" && codexFailed(input.tool_response))) {
    const hay = event === "UserPromptSubmit" ? input.prompt ?? "" : `${input.tool_input?.command ?? ""}\n${input.error ?? responseText(input.tool_response)}`;
    const all = (await db.execute({ sql: `SELECT l.id,l.text,l.always_on,l.updated_at,t.pattern FROM lessons l JOIN triggers t ON t.lesson_id=l.id WHERE ${scope}`, args: [repo, repo] })).rows as unknown as Row[];
    rows = all.filter((r) => r.pattern && matches(r.pattern, hay));
  }
  // Once per session, reset by compaction. Tokens count for the whole session.
  const lastCompact = event === "SessionStart" && input.source === "compact" ? ts : session ? String((await db.execute({ sql: "SELECT max(ts) t FROM deliveries WHERE session=? AND event='SessionStart' AND source='compact'", args: [session] })).rows[0]?.t ?? "") : "";
  const sent = new Set(session ? (await db.execute({ sql: "SELECT lesson_id FROM deliveries WHERE session=? AND outcome='sent' AND ts>=?", args: [session, lastCompact] })).rows.map((r) => String(r.lesson_id)) : []);
  let used = session ? Number((await db.execute({ sql: "SELECT coalesce(sum(tokens),0) t FROM deliveries WHERE session=? AND outcome='sent' AND handoff_id IS NULL", args: [session] })).rows[0]?.t ?? 0) : 0;
  const cfg = settings();
  const seen = new Set<string>();
  const ranked = rows.filter((r) => !sent.has(r.id) && !seen.has(r.id) && seen.add(r.id))
    .sort((a, b) => b.always_on - a.always_on || (b.pattern?.length ?? 0) - (a.pattern?.length ?? 0) || b.updated_at.localeCompare(a.updated_at));
  const out: Row[] = []; let here = 0;
  for (const r of ranked) {
    const t = tokens(r.text);
    if (out.length >= cfg.maxPerDelivery || here + t > cfg.tokensPerDelivery || used + t > cfg.tokensPerSession) { await log("limit", r); continue; }
    out.push(r); here += t; used += t;
  }
  for (const r of out) await log("sent", r, tokens(r.text));
  let waiting = 0;
  // The "lessons waiting" reminder goes to the agent at most once a day per repo, so it doesn't nag.
  const nudgeKey = `nudged:${repo ?? ""}`;
  const lastNudge = String((await db.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [nudgeKey] })).rows[0]?.value ?? "");
  const nudgeDue = !lastNudge || Date.now() - Date.parse(lastNudge) > 20 * 3_600_000;
  if (event === "SessionStart" && input.source === "startup" && nudgeDue) waiting = Number((await db.execute({ sql: "SELECT count(*) n FROM lessons l WHERE l.status='proposed' AND (l.repo_id IS ? OR l.repo_id=?)", args: [repo, repo] })).rows[0]?.n ?? 0);
  // Where the last session on this branch left off, at the start of a fresh session only.
  let handoff: string | null = null;
  if (event === "SessionStart" && (input.source === "startup" || input.source === "clear") && repo && input.cwd) {
    const branch = currentBranch(input.cwd);
    const h = branch ? await latestHandoff(db, repo, branch, cfg.handoffDays, session) : null;
    if (h) {
      handoff = handoffText(h);
      await db.execute({ sql: "INSERT INTO deliveries (id,ts,tool,session,event,source,lesson_id,outcome,tokens,handoff_id) VALUES (?,?,?,?,?,?,NULL,'sent',?,?)", args: [randomUUID(), ts, client, session, event, input.source ?? null, tokens(handoff), h.id] });
    }
  }
  if (!out.length && !waiting && !handoff) { await log("no_match"); return null; }
  const lines: string[] = [];
  if (handoff) lines.push(handoff, "");
  if (out.length) lines.push("Lessons the engineer kept in muninn, from earlier sessions:", ...out.map((r) => `- ${r.text}`));
  if (waiting) await db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)", args: [nudgeKey, ts] });
  if (waiting) lines.push(`muninn has ${waiting} new lesson(s) waiting. If it fits the conversation, mention that the engineer can review them with "muninn review".`);
  return lines.join("\n");
}

export const hookOutput = (event: string, text: string) => JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });
