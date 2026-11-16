import { matches } from "../deliver/hook.js";
import { scanLogs } from "../logs/discover.js";
import type { Session } from "../logs/types.js";
import { redact } from "../privacy/redact.js";

/**
 * "When would this have been told?": a lesson's trigger words tried against your past sessions in its repo,
 * the way the hooks would have tried them (your prompts, and failed commands). No model calls.
 */
export type Replay = { sessions: number; told: number; examples: { at: string; where: string; text: string }[]; sentence: string };

let cache: { at: number; byRepo: Map<string, Session[]> } | null = null;
/** The logs, read at most once a minute: trying several words in a row shouldn't re-read them each time. */
function sessionsFor(repo: string): Session[] {
  if (!cache || Date.now() - cache.at > 60_000) cache = { at: Date.now(), byRepo: scanLogs().byRepo };
  return cache.byRepo.get(repo) ?? [];
}

const around = (text: string, word: string) => {
  const i = text.toLowerCase().indexOf(word.toLowerCase());
  const from = Math.max(0, i - 50);
  return redact(`${from ? "…" : ""}${text.slice(from, from + 140).replace(/\s+/g, " ").trim()}${text.length > from + 140 ? "…" : ""}`);
};

export function replay(repo: string, route: "always" | "keyword" | "none", words: string[], sessions = sessionsFor(repo)): Replay {
  const n = sessions.length;
  if (route === "always") return { sessions: n, told: n, examples: [], sentence: n ? `It would have been told at the start of all ${n} of your sessions here.` : "No sessions here yet." };
  if (route === "none") return { sessions: n, told: 0, examples: [], sentence: "It's never told on its own. Agents find it only by running muninn ask." };
  const ws = words.map((w) => w.trim()).filter(Boolean);
  if (!ws.length) return { sessions: n, told: 0, examples: [], sentence: "Add a word first." };
  let told = 0;
  const examples: Replay["examples"] = [];
  for (const s of sessions) {
    let hit = false;
    for (const e of s.events) {
      const where = e.k === "typed" ? "your prompt" : e.k === "cmd" && e.failed ? "a failed command" : null;
      if (!where) continue;
      const hay = e.k === "typed" ? e.text : e.k === "cmd" ? `${e.cmd}\n${e.output}` : "";
      const w = ws.find((x) => matches(x, hay));
      if (!w) continue;
      hit = true;
      if (examples.length < 5) examples.push({ at: e.ts, where, text: around(hay, w) });
      break;
    }
    if (hit) told++;
  }
  const quoted = ws.map((w) => `"${w}"`).join(" or ");
  const sentence = !n ? "No sessions here yet, so there's nothing to try it on."
    : !told ? `In your last ${n} sessions here, ${quoted} never came up, so it would never have been told. Try a word you'd actually type or see in an error.`
    : told / n > 0.6 && n >= 3 ? `It would have been told in ${told} of your last ${n} sessions here. That's most of them: a more specific word would be told only when it matters, or choose every session.`
    : `It would have been told in ${told} of your last ${n} sessions here.`;
  return { sessions: n, told, examples, sentence };
}
