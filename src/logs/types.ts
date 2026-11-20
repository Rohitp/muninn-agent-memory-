export type LogEvent =
  | { k: "typed"; text: string; ts: string }
  | { k: "agent"; text: string; ts: string }
  | { k: "cmd"; cmd: string; failed: boolean; output: string; ts: string; stopped?: boolean }
  /** A file read, edit or search through the agent's own tools rather than the shell. `path` is the file or folder it named. */
  | { k: "file"; tool: string; path: string; pattern?: string; failed: boolean; output: string; ts: string }
  /** The engineer stopped the agent while it was answering (not a single command: that's a stopped "cmd"). */
  | { k: "interrupt"; ts: string };
/** One event as a line of plain text, for summaries. */
export const eventLine = (e: LogEvent): string =>
  e.k === "typed" ? `ENGINEER: ${e.text.slice(0, 1500)}`
  : e.k === "agent" ? `AGENT: ${e.text.slice(0, 600)}`
  : e.k === "cmd" ? `COMMAND${e.failed ? " (failed)" : ""}: ${e.cmd.slice(0, 200)}`
  : e.k === "file" ? `${e.tool.toUpperCase()}${e.failed ? " (failed)" : ""}: ${e.path.slice(0, 200)}`
  : "ENGINEER stopped the answer";
export type Tool = "claude-code" | "codex" | "cursor";
export type Session = { id: string; tool: Tool; cwd: string; clientVersion: string; events: LogEvent[]; unknown: number; branch?: string; file?: string };
/** First text of every LLM run muninn starts, so readers can skip those sessions. */
export const OWN_RUN_MARK = "[muninn-lesson-writer]";
export const parseLines = (f: string, read: (f: string) => string): any[] =>
  read(f).split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
export const textOf = (c: unknown): string =>
  typeof c === "string" ? c
  : Array.isArray(c) ? c.map((x: any) => (["text", "input_text", "output_text"].includes(x?.type) ? x.text ?? "" : "")).join(" ")
  : "";
const NOT_TYPED = ["<", "Caveat:", "[Request interrupted", "This session is being continued", "Base directory for this skill", "## My request", "# Files pasted by the user", "Pasted text contains", "Briefly inform the user about the task result"];
export const notTyped = (t: string) => NOT_TYPED.some((s) => t.trimStart().startsWith(s));
export const isOwnRun = (s: Session) => s.events.some((e) => e.k === "typed" && e.text.includes(OWN_RUN_MARK));
/** A tool result showing the engineer stopped or rejected the call, rather than the command failing. */
export const STOPPED = /The user doesn't want to proceed with this tool use|\[Request interrupted by user for tool use\]|The user rejected this|was rejected by the user/;
