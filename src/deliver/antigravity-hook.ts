import type { Client } from "@libsql/client";
import { existsSync, mkdirSync, readFileSync, copyFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { deliver } from "./hook.js";

/**
 * muninn in Antigravity's hooks (antigravity.google/docs/hooks), for what rules files can't do: speak up mid-run.
 * After a command fails, muninn checks for the same failure in a row, as it does in Claude Code; the warning
 * waits until Antigravity's next model turn (PreInvocation), the one point where a hook can add text the agent reads.
 * Keyword lessons that match what you typed go along too. Antigravity doesn't say which event a hook is for,
 * so each of muninn's hook commands names it.
 */
export const antigravityHooksFile = () => process.env.MUNINN_ANTIGRAVITY_HOOKS ?? join(homedir(), ".gemini", "config", "hooks.json");
const KEY = "muninn";

/** Antigravity writes tool arguments JSON-encoded a second time ("\"ls\""). */
const unquote = (v: unknown) => { if (typeof v === "string" && v.length > 1 && v.startsWith('"') && v.endsWith('"')) { try { return JSON.parse(v); } catch { /* as is */ } } return v; };
const pendingKey = (conv: string) => `ag_pending:${conv}`;

type AgInput = { conversationId?: string; workspacePaths?: string[]; lastUserInput?: string; toolCall?: { name?: string; args?: Record<string, unknown> }; error?: string };

/** Handles one Antigravity hook call. Returns what to print: JSON for Antigravity, or nothing. */
export async function antigravityHook(db: Client, event: string, input: AgInput): Promise<string | null> {
  const conv = String(input.conversationId ?? "");
  const cwd = input.workspacePaths?.[0];
  if (!conv || !cwd) return null;
  if (event === "PostToolUse") {
    if (!input.error) return "{}";
    const name = String(input.toolCall?.name ?? "");
    const a = input.toolCall?.args ?? {};
    const cmd = String(unquote(a.CommandLine ?? a.command ?? "") ?? "");
    const text = await deliver(db, "antigravity", { hook_event_name: "PostToolUseFailure", session_id: conv, cwd, tool_name: name === "run_command" ? "Bash" : name, tool_input: { command: cmd }, error: String(input.error) });
    if (text) {
      const old = (await db.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [pendingKey(conv)] })).rows[0]?.value;
      await db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)", args: [pendingKey(conv), [old, text].filter(Boolean).join("\n\n")] });
    }
    return "{}";
  }
  if (event === "PreInvocation") {
    const pending = String((await db.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [pendingKey(conv)] })).rows[0]?.value ?? "");
    if (pending) await db.execute({ sql: "DELETE FROM meta WHERE key=?", args: [pendingKey(conv)] });
    // Keyword lessons for what you typed, once per conversation (deliver remembers what it sent).
    const told = input.lastUserInput ? await deliver(db, "antigravity", { hook_event_name: "UserPromptSubmit", session_id: conv, cwd, prompt: String(input.lastUserInput) }) : null;
    const text = [pending, told].filter(Boolean).join("\n\n");
    return text ? JSON.stringify({ injectSteps: [{ systemMessage: { systemMessage: text } }] }) : null;
  }
  return null;
}

/** Adds or removes muninn's hooks in Antigravity's global hooks file, keeping everything else and a backup. */
export function setAntigravityHooks(command: (event: string) => string, on: boolean): boolean {
  const file = antigravityHooksFile();
  if (!existsSync(dirname(dirname(file))) && on) return false; // Antigravity isn't installed (~/.gemini is missing)
  let cfg: Record<string, unknown> = {};
  if (existsSync(file)) {
    const raw = readFileSync(file, "utf8");
    if (raw.trim()) { try { cfg = JSON.parse(raw); } catch { throw new Error(`${file} isn't valid JSON, so muninn left it alone.`); } }
  }
  if (!on) { if (!(KEY in cfg)) return false; delete cfg[KEY]; writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n"); return true; }
  const want = {
    PostToolUse: [{ matcher: "run_command", hooks: [{ type: "command", command: command("PostToolUse"), timeout: 5 }] }],
    PreInvocation: [{ type: "command", command: command("PreInvocation"), timeout: 5 }],
  };
  // Already as wanted: change nothing, and say nothing.
  if (JSON.stringify(cfg[KEY]) === JSON.stringify(want)) return false;
  if (existsSync(file)) copyFileSync(file, `${file}.muninn-backup`);
  cfg[KEY] = want;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(cfg, null, 2) + "\n");
  return true;
}
