import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { notTyped, parseLines, type LogEvent, type Session } from "./types.js";

/**
 * Cursor agent transcripts: ~/.cursor/projects/<slug>/agent-transcripts/<id>/<id>.jsonl.
 * Each line is {role, message: {content: [{type: "text"|"tool_use", ...}]}}. Typed text is wrapped as
 * <timestamp>...</timestamp><user_query>...</user_query>. There are no command results, so Cursor
 * sessions feed repeats, corrections and notes, not command signals. The format is undocumented.
 */
export function readCursor(file: string, projectsRoot: string): Session {
  const events: LogEvent[] = [];
  let unknown = 0, ts = "", workdir = "";
  try { ts = statSync(file).mtime.toISOString(); } catch { /* keep empty */ }
  const fallbackTs = ts;
  for (const o of parseLines(file, (f) => readFileSync(f, "utf8"))) {
    if (o.type === "turn_ended") continue;
    const c = o.message?.content;
    if (!Array.isArray(c) || (o.role !== "user" && o.role !== "assistant")) { unknown++; continue; }
    for (const b of c) {
      if (o.role === "user" && b?.type === "text") {
        const raw = String(b.text ?? "");
        const when = raw.match(/<timestamp>([\s\S]*?)<\/timestamp>/)?.[1];
        if (when) ts = parseCursorTime(when) ?? ts;
        const q = raw.match(/<user_query>([\s\S]*?)<\/user_query>/)?.[1]?.trim();
        const text = q ?? (raw.trimStart().startsWith("<") ? "" : raw.trim());
        if (text && !notTyped(text)) events.push({ k: "typed", text, ts });
      }
      if (o.role === "assistant" && b?.type === "text") events.push({ k: "agent", text: String(b.text ?? ""), ts });
      if (o.role === "assistant" && b?.type === "tool_use" && !workdir && typeof b.input?.working_directory === "string") workdir = b.input.working_directory;
    }
  }
  const slug = file.slice(projectsRoot.length + 1).split(/[\\/]/)[0] ?? "";
  const cwd = slugToPath(slug) ?? workdir;
  return { id: basename(file, ".jsonl"), tool: "cursor", cwd, clientVersion: "unknown", events: events.map((e) => (e.ts ? e : { ...e, ts: fallbackTs })), unknown, file };
}

/** "Tuesday, Oct 27, 2026, 12:41 PM (UTC)" to ISO. */
export function parseCursorTime(s: string): string | null {
  const m = s.match(/([A-Z][a-z]{2,8})\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(?:\((UTC|GMT)\))?/);
  if (!m) return null;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const mon = months.indexOf(m[1]!.slice(0, 3).toLowerCase());
  if (mon < 0) return null;
  let h = Number(m[4]) % 12; if (m[6] === "PM") h += 12; if (!m[6]) h = Number(m[4]);
  return new Date(Date.UTC(Number(m[3]), mon, Number(m[2]), h, Number(m[5]))).toISOString();
}

const slugCache = new Map<string, string | null>();
/** Cursor names project folders by the path with separators turned into dashes. Rebuilds the path by checking which folders exist. */
export function slugToPath(slug: string, root = "/"): string | null {
  const key = `${root}\u0000${slug}`;
  if (slugCache.has(key)) return slugCache.get(key)!;
  const parts = slug.split("-").filter((p) => p !== "");
  const walk = (dir: string, i: number): string | null => {
    if (i === parts.length) return dir;
    for (let j = parts.length; j > i; j--) {
      for (const sep of j === i + 1 ? ["-"] : ["-", ".", "_", " "]) {
        const next = join(dir, parts.slice(i, j).join(sep));
        if (existsSync(next)) { const r = walk(next, j); if (r) return r; }
      }
    }
    return null;
  };
  const out = parts.length ? walk(root, 0) : null;
  slugCache.set(key, out);
  return out;
}
