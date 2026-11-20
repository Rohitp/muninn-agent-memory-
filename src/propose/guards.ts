import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { claudeSettingsFile } from "../commands/install.js";
import type { Session } from "../logs/types.js";
import { redact } from "../privacy/redact.js";
import { registerApplier, type NewProposal } from "./store.js";

/** Commands that are risky on their own, so a one-word rule is still specific enough. */
const ALONE = new Set(["rm", "sudo", "dd", "kill", "killall", "pkill", "shutdown", "reboot", "mkfs", "chmod", "chown"]);
/** Where Claude Code keeps permission rules for one repo on this machine only. */
export const LOCAL_SETTINGS = join(".claude", "settings.local.json");

/**
 * The part of a command a rule should match: the program, its subcommand, and the flags right after it.
 * `git push --force origin main` → `git push --force`; `rm -rf build` → `rm -rf`. Too general (`python3`) gives null.
 */
export function guardPrefix(cmd: string): string | null {
  let c = (cmd.replace(/^\/bin\/(ba|z)?sh\s+-l?c\s+/, "").split("\n")[0] ?? "").replace(/^["']|["']$/g, "");
  c = c.replace(/^\s*cd\s+\S+\s*(&&|;)\s*/, "");
  const first = (c.split(/&&|\|\||;|\|/)[0] ?? "").trim().replace(/^(\w+=\S+\s+)+/, "");
  const words = first.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const [i, w] of words.entries()) {
    if (out.length >= 4) break;
    if (i === 0) { if (!/^[\w.-]+$/.test(w)) return null; out.push(w); continue; }
    if (w.startsWith("-") && /^-{1,2}[\w-]+(=\S+)?$/.test(w)) { out.push(w.replace(/=.*/, "")); continue; }
    // A subcommand: a plain word straight after the program (push, publish, reset). Anything else is an argument.
    if (i === 1 && /^[a-z][\w-]*$/.test(w) && !w.includes(".")) { out.push(w); continue; }
    break;
  }
  if (out.length < 2 && !ALONE.has(out[0] ?? "")) return null;
  return out.join(" ");
}
/** Whether a command's prefix starts with a rule's words: `git push --force -u` matches `git push --force`. */
const covers = (rule: string, prefix: string) => (prefix + " ").startsWith(rule + " ");

function rulesIn(file: string): string[] {
  try { const s = JSON.parse(readFileSync(file, "utf8")); return [...(s.permissions?.ask ?? []), ...(s.permissions?.deny ?? [])].map(String); }
  catch { return []; }
}
/** Rules already set for a repo: in its shared and local settings, and in your user settings. */
export function existingRules(root: string | null): string[] {
  return [...(root ? [join(root, ".claude", "settings.json"), join(root, LOCAL_SETTINGS)] : []), claudeSettingsFile()].filter(existsSync).flatMap(rulesIn);
}
export const ruleFor = (prefix: string) => `Bash(${prefix}:*)`;

/**
 * Commands you stopped before they ran, at least twice in different sessions (or three times anywhere), become a
 * proposed "ask first" rule. Says how often you let the same command run, so a rule that would ask too often shows.
 */
export function guardProposals(repo: string, sessions: Session[], root: string | null): NewProposal[] {
  const stops = new Map<string, { session: string; tool: string; ts: string; cmd: string }[]>();
  const ran: string[] = [];
  for (const s of sessions) for (const e of s.events) {
    if (e.k !== "cmd") continue;
    const p = guardPrefix(e.cmd);
    if (!p) continue;
    if (e.stopped) stops.set(p, [...(stops.get(p) ?? []), { session: s.id, tool: s.tool, ts: e.ts, cmd: e.cmd }]);
    else ran.push(p);
  }
  const have = existingRules(root);
  const out: NewProposal[] = [];
  for (const [prefix, hits] of stops) {
    const sessionsHit = new Set(hits.map((h) => h.session)).size;
    if (!(sessionsHit >= 2 || hits.length >= 3)) continue;
    const rule = ruleFor(prefix);
    if (have.some((r) => r === rule || (r.startsWith("Bash(") && covers(r.slice(5).replace(/(:\*|\s\*)?\)$/, ""), prefix)))) continue;
    const allowed = ran.filter((r) => covers(prefix, r)).length;
    out.push({
      repo_id: repo, kind: "guard", key: `guard:${rule}`,
      title: `Ask before running \`${prefix}\``,
      why: `You stopped \`${prefix}\` ${hits.length} times in ${sessionsHit} session(s) before it ran${allowed ? `, and let it run ${allowed} time(s)` : ", and never let it run"}. With this rule Claude Code asks you first, in every mode including auto mode${allowed ? `, so it would also have asked those ${allowed} time(s)` : ""}. It's written to this repo's ${LOCAL_SETTINGS}, which stays on this machine.`,
      payload: { rule, list: "ask", prefix, stopped: hits.length, allowed },
      evidence: hits.slice(-3).map((h) => ({ session: h.session, tool: h.tool, ts: h.ts, quote: redact(`stopped: ${h.cmd.replace(/\s+/g, " ").slice(0, 160)}`) })),
    });
  }
  return out;
}

registerApplier("guard", (p, root) => {
  if (!root) return "Couldn't find this repo's folder on this machine.";
  const file = join(root, LOCAL_SETTINGS);
  let s: Record<string, any> = {};
  if (existsSync(file)) { try { s = JSON.parse(readFileSync(file, "utf8")); } catch { return `${file} isn't valid JSON, so muninn left it alone.`; } }
  const list = String(p.payload.list ?? "ask");
  s.permissions ??= {}; s.permissions[list] ??= [];
  if (!s.permissions[list].includes(p.payload.rule)) s.permissions[list].push(p.payload.rule);
  return [{ file, after: JSON.stringify(s, null, 2) + "\n", exclude: { root, path: LOCAL_SETTINGS } }];
});
