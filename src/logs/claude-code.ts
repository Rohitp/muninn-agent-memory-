import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { notTyped, parseLines, STOPPED, textOf, type LogEvent, type Session } from "./types.js";

/** Claude Code's own tools that name a file or folder. */
const FILE_TOOLS = new Set(["Read", "Edit", "MultiEdit", "Write", "NotebookEdit", "Grep", "Glob", "Skill"]);
/** The engineer stopped the answer itself. "…for tool use" is a stopped command, which the command result shows. */
const INTERRUPTED = /^\s*\[Request interrupted by user\]/;

export function readClaude(file: string): Session {
  const events: LogEvent[] = [];
  // What each tool call asked for, until its result arrives: a shell command, or a file tool and the path it named.
  const pending = new Map<string, { cmd: string } | { tool: string; path: string; pattern?: string }>();
  let cwd = "", clientVersion = "unknown", unknown = 0, branch = "";
  for (const o of parseLines(file, (f) => readFileSync(f, "utf8"))) {
    // New record types are normal. A message without the expected shape means the format changed.
    if (typeof o.type !== "string" || ((o.type === "user" || o.type === "assistant") && o.message?.content === undefined)) unknown++;
    if (o.cwd) cwd ||= o.cwd;
    if (o.version) clientVersion = o.version;
    if (o.gitBranch) branch = o.gitBranch;
    if (o.isSidechain || o.isMeta) continue;
    const c = o.message?.content;
    const ts = o.timestamp ?? "";
    if (o.type === "user") {
      if (typeof c === "string") { if (INTERRUPTED.test(c)) events.push({ k: "interrupt", ts }); else if (!notTyped(c)) events.push({ k: "typed", text: c, ts }); continue; }
      for (const x of Array.isArray(c) ? c : []) {
        if (x?.type === "text" && INTERRUPTED.test(x.text ?? "")) events.push({ k: "interrupt", ts });
        else if (x?.type === "text" && !notTyped(x.text ?? "")) events.push({ k: "typed", text: x.text, ts });
        if (x?.type === "tool_result" && pending.has(x.tool_use_id)) {
          const r = o.toolUseResult ?? {};
          const call = pending.get(x.tool_use_id)!;
          pending.delete(x.tool_use_id);
          if (!("cmd" in call)) {
            // A file tool's result is the file itself: keep only enough to see why it failed.
            const output = (typeof r === "string" ? r : textOf(x.content)).slice(0, 400);
            if (!STOPPED.test(output)) events.push({ k: "file", ...call, failed: x.is_error === true, output, ts });
            continue;
          }
          const output = [r.stderr, r.stdout, typeof r === "string" ? r : "", textOf(x.content)].filter(Boolean).join("\n");
          const stopped = x.is_error === true && STOPPED.test(output);
          events.push({ k: "cmd", cmd: call.cmd, failed: x.is_error === true, output: output.slice(-2000), ts, ...(stopped ? { stopped } : {}) });
        }
      }
    }
    if (o.type === "assistant") for (const x of Array.isArray(c) ? c : []) {
      if (x?.type === "text") events.push({ k: "agent", text: x.text ?? "", ts });
      if (x?.type === "tool_use" && x.name === "Bash") pending.set(x.id, { cmd: x.input?.command ?? "" });
      const path = x?.type === "tool_use" && FILE_TOOLS.has(x.name) ? x.input?.file_path ?? x.input?.notebook_path ?? x.input?.path ?? x.input?.skill : undefined;
      if (typeof path === "string" && path) pending.set(x.id, { tool: String(x.name).toLowerCase(), path, ...(typeof x.input?.pattern === "string" ? { pattern: x.input.pattern } : {}) });
    }
  }
  return { id: basename(file, ".jsonl"), tool: "claude-code", cwd, clientVersion, events, unknown, branch: branch || undefined, file };
}
