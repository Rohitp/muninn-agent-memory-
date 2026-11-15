import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { notTyped, parseLines, textOf, type LogEvent, type Session } from "./types.js";

export function readClaude(file: string): Session {
  const events: LogEvent[] = [];
  const pending = new Map<string, string>();
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
      if (typeof c === "string") { if (!notTyped(c)) events.push({ k: "typed", text: c, ts }); continue; }
      for (const x of Array.isArray(c) ? c : []) {
        if (x?.type === "text" && !notTyped(x.text ?? "")) events.push({ k: "typed", text: x.text, ts });
        if (x?.type === "tool_result" && pending.has(x.tool_use_id)) {
          const r = o.toolUseResult ?? {};
          const output = [r.stderr, r.stdout, typeof r === "string" ? r : "", textOf(x.content)].filter(Boolean).join("\n");
          events.push({ k: "cmd", cmd: pending.get(x.tool_use_id)!, failed: x.is_error === true, output: output.slice(-2000), ts });
          pending.delete(x.tool_use_id);
        }
      }
    }
    if (o.type === "assistant") for (const x of Array.isArray(c) ? c : []) {
      if (x?.type === "text") events.push({ k: "agent", text: x.text ?? "", ts });
      if (x?.type === "tool_use" && x.name === "Bash") pending.set(x.id, x.input?.command ?? "");
    }
  }
  return { id: basename(file, ".jsonl"), tool: "claude-code", cwd, clientVersion, events, unknown, branch: branch || undefined, file };
}
