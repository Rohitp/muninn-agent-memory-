export type LogEvent =
  | { k: "typed"; text: string; ts: string }
  | { k: "agent"; text: string; ts: string }
  | { k: "cmd"; cmd: string; failed: boolean; output: string; ts: string };
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
