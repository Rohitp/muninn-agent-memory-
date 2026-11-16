import { createHash } from "node:crypto";
import { redact } from "../privacy/redact.js";
import { cosine, type Embed } from "../embed/model.js";
import type { Session } from "../logs/types.js";

export type Signal = "repeat" | "correction" | "failure_then_fix" | "mistake_returned" | "explained" | "loop" | "refetch" | "stopped" | "confused" | "friction";
export type Moment = {
  signal: Signal; text: string; quotes: { tool: string; session: string; ts: string; quote: string }[];
  sessions: number; days: number; wordings: number; tools: string[]; last: string; vector?: Float32Array;
  context?: string;
  /** Tokens of output the problem wasted: failed repeats and re-reads, not the first try. */
  wasted?: number;
};
const norm = (s: string) => s.toLowerCase().replace(/\W+/g, " ").trim();
const NEG = /\b(not|never|don'?t|no|avoid|stop|cannot|won'?t|shouldn'?t|without)\b/i;
const STOP = new Set(["run the tests", "commit this", "continue", "go ahead", "looks good", "fix it", "push it"]);
const CHAT = /^(ok|okay|yes|yep|yeah|no|nope|thanks|thank you|sure|cool|great|nice|hmm|hi|hello|lets|let s|what|why|how|where|when|who|which|did|do you|is|are|can you|could you|does|got it|right|and|but|so|or|if|i see)\b/i;
const CORRECTION = /^(no\b|nope\b|don'?t\b|do not\b|wrong\b|not that\b|that'?s (wrong|not)\b|stop\b|actually\b)|\binstead\b/i;
const BENIGN = /^(grep|rg|diff|test|\[|which|pgrep|find|ls|cat|sed|head|tail|awk|command|type|echo|python3? -|git (diff|status|log|show|grep|rev-parse))\b/;
const seg = new Intl.Segmenter("en", { granularity: "sentence" });

export function sentences(text: string): string[] {
  if (text.length > 2000 || text.split("\n").length > 20) return [];
  return text.replace(/```[\s\S]*?```/g, " ").split("\n").filter((l) => !l.trim().startsWith(">"))
    .flatMap((l) => [...seg.segment(l)].map((x) => x.segment.trim().replace(/^[-*\s]+/, ""))).filter(Boolean);
}
export function normCommand(raw: string): string {
  let c = raw.replace(/^\/bin\/(ba|z)?sh\s+-l?c\s+/, "").replace(/^["']|["']$/g, "");
  const [first = "", ...rest] = c.split("\n");
  c = first.replace(/^\s*cd\s+\S+\s*(&&|;)\s*/, "").replace(/^(\w+=\S+\s+)+/, "").trim();
  const key = c.replace(/\/[\w.@/-]+/g, "<path>").replace(/\b[0-9a-f]{7,}\b/g, "<id>").replace(/\b\d+\b/g, "<n>").slice(0, 90);
  // A heredoc's first line ("python3 - <<'EOF'") says nothing about the script: different scripts must not look alike.
  if (/<</.test(first) && rest.length) return `${key} #${createHash("sha1").update(rest.join("\n").replace(/\d+/g, "").replace(/\s+/g, " ")).digest("hex").slice(0, 6)}`;
  return key;
}
/** One run as evidence: the command on one line, and the first line it printed. */
export function shown(cmd: string, output: string): string {
  const c = cmd.replace(/\s+/g, " ").trim();
  const said = output.split("\n").map((l) => l.trim()).find(Boolean) ?? "(no output)";
  return redact(`$ ${c.length > 150 ? c.slice(0, 149) + "…" : c}  →  ${said.slice(0, 80)}`);
}
/** Whether a later run's output repeats an earlier one's: most of the earlier lines show up again. */
export function repeats(earlier: string, later: string): boolean {
  const lines = [...new Set(earlier.split("\n").map((l) => l.trim()).filter((l) => l.length >= 6))];
  if (lines.length < 2) return false;
  return lines.filter((l) => later.includes(l)).length / lines.length >= 0.6;
}
export function errorLine(o: string): string {
  const ls = o.split("\n").map((l) => l.trim()).filter(Boolean);
  const e = [...ls].reverse().find((l) => /error|fail|exception|denied|not found|cannot|unable/i.test(l)) ?? ls.at(-1) ?? "";
  return e.replace(/\/[\w.@/-]+/g, "<path>").replace(/\b[0-9a-f]{7,}\b/g, "<id>").replace(/\d+/g, "<n>").slice(0, 120);
}

type Item = { text: string; session: string; tool: string; ts: string; before?: string };
type Cluster = { first: Float32Array; firstText: string; items: Item[] };

function cluster(items: Item[], vectors: Map<string, Float32Array>, cutoff: number): Cluster[] {
  const out: Cluster[] = [];
  for (const it of [...items].sort((a, b) => a.ts.localeCompare(b.ts))) {
    const v = vectors.get(norm(it.text))!;
    const hit = out.find((c) => cosine(c.first, v) >= cutoff && NEG.test(c.firstText) === NEG.test(it.text));
    if (hit) hit.items.push(it); else out.push({ first: v, firstText: it.text, items: [it] });
  }
  return out;
}
/** Hours between the first and last time something was said: work in one long session can span days. */
const spanHours = (c: Cluster) => { const t = c.items.map((i) => Date.parse(i.ts)).filter((x) => !Number.isNaN(x)); return t.length ? (Math.max(...t) - Math.min(...t)) / 3_600_000 : 0; };
function toMoment(signal: Signal, c: Cluster): Moment {
  const seen = new Set<string>(); const quotes: Moment["quotes"] = [];
  for (const i of [...c.items].reverse()) {
    const quote = redact((i.before ? `after "${i.before}": ` : "") + i.text).slice(0, 240);
    if (seen.has(norm(i.text)) || quotes.length >= 3) continue;
    seen.add(norm(i.text)); quotes.push({ tool: i.tool, session: i.session, ts: i.ts, quote });
  }
  return {
    signal, text: redact(c.items.map((i) => i.text).reduce((a, b) => (b.length > a.length ? b : a))), quotes,
    sessions: new Set(c.items.map((i) => i.session)).size, days: new Set(c.items.map((i) => i.ts.slice(0, 10))).size,
    wordings: new Set(c.items.map((i) => norm(i.text))).size, tools: [...new Set(c.items.map((i) => i.tool))],
    last: c.items.at(-1)!.ts, vector: c.first,
  };
}

/** One group of similar things you typed, as detection saw it: for tuning the thresholds against real logs. */
export type Considered = { signal: "repeat" | "correction"; texts: string[]; times: number; sessions: number; wordings: number; days: number; hours: number; kept: boolean };
export async function findMoments(sessions: Session[], embed: Embed, opts: { cutoff: number; minSessions: number; trace?: (c: Considered) => void }): Promise<Moment[]> {
  const agent = new Set<string>();
  for (const s of sessions) for (const e of s.events) if (e.k === "agent") for (const x of sentences(e.text)) agent.add(norm(x));
  const repeats: Item[] = []; const corrections: Item[] = [];
  for (const s of sessions) {
    let prev = "";
    for (const e of s.events) {
      if (e.k === "agent") { prev = e.text.slice(0, 160); continue; }
      if (e.k === "cmd") { prev = `ran: ${e.cmd.slice(0, 140)}`; continue; }
      for (const x of sentences(e.text)) {
        const n = norm(x);
        if (n.split(" ").length < 2 || STOP.has(n) || agent.has(n) || x.length > 240) continue;
        if (prev && CORRECTION.test(x)) corrections.push({ text: x, session: s.id, tool: s.tool, ts: e.ts, before: prev });
        if (!x.endsWith("?") && !CHAT.test(x)) repeats.push({ text: x, session: s.id, tool: s.tool, ts: e.ts });
      }
      prev = "";
    }
  }
  const vectors = await embed([...repeats, ...corrections].map((i) => norm(i.text)));
  const moments: Moment[] = [];
  for (const c of cluster(repeats, vectors, opts.cutoff)) {
    const m = toMoment("repeat", c);
    // Across sessions, or within one long session: said 3 times, in more than one wording, hours apart.
    const inOneLong = c.items.length >= 3 && m.wordings >= 2 && spanHours(c) >= 2;
    const kept = m.days >= 3 || (m.sessions >= opts.minSessions && m.wordings >= 2) || inOneLong;
    if (kept) moments.push(m);
    if (c.items.length >= 2) opts.trace?.({ signal: "repeat", texts: c.items.map((i) => i.text), times: c.items.length, sessions: m.sessions, wordings: m.wordings, days: m.days, hours: spanHours(c), kept });
  }
  for (const c of cluster(corrections, vectors, opts.cutoff)) {
    const m = toMoment("correction", c);
    m.context = c.items.at(-1)?.before ? redact(c.items.at(-1)!.before!) : undefined;
    const kept = m.sessions >= 2 || (c.items.length >= 2 && spanHours(c) >= 1);
    if (kept) moments.push(m);
    opts.trace?.({ signal: "correction", texts: c.items.map((i) => `${i.text}   ⟵ after: ${i.before?.slice(0, 100) ?? ""}`), times: c.items.length, sessions: m.sessions, wordings: m.wordings, days: m.days, hours: spanHours(c), kept });
  }
  moments.push(...commandMoments(sessions), ...explainedMoments(sessions), ...intentMoments(sessions));
  return moments;
}

/** A long message where the engineer explained something. Said once, so no repeat signal sees it. The writer decides if it holds lasting knowledge. */
export function isExplanation(text: string): boolean {
  const t = text.replace(/```[\s\S]*?```/g, " ").trim();
  if (t.length < 300 || text.length > 6000) return false;
  const parts = [...seg.segment(t)].map((x) => x.segment.trim()).filter((x) => x.split(/\s+/).length >= 4);
  if (parts.length < 3) return false;
  const questions = parts.filter((p) => p.endsWith("?")).length;
  return questions / parts.length < 0.5;
}
/**
 * Messages grouped by what they're doing rather than how they're worded. In a long session you mostly approve,
 * ask and report; the lessons are in the asking ("what is harder-data?", "I don't understand this") and the
 * friction ("why are we asking for simple API calls?", "stuck in loading"). Wording differs every time, so
 * similarity misses them; the pattern of the message doesn't. Each comes with what the agent said just before,
 * since that's usually what caused it.
 */
// "what" as people type it in a hurry: wht, wat, waht, whast.
const W = "(?:what|wht|wat|waht|whta|whast|whats|what's|wats)";
export const CONFUSED = new RegExp(`\\b(${W} (is|are|does|do|was|were) (a |an |the )?[\\w.-]*[-_][\\w.-]*|${W} (is |are )?(a|an|the|this|that|these) |${W} is |${W} does .{1,40} (do|mean)|${W} do (i|you) (need to|have to|mean)|${W} am i (testing|looking at|supposed to)|how do i |where do i |i (don'?t|dont|do not) (understand|get it|follow|know what)|n[oi]t sure what|(is|it'?s|its|this is) (unclear|confusing)|unclear|confus(ed|ing)|hard to (parse|follow|understand|read|explain)|makes? no sense|easier explanation|explain (this|that|it|again|more)|${W} do you mean)`, "i");
/** Asking for what's next, or what else, isn't confusion. */
const NOT_CONFUSED = /\bwhat'?s? (next|else|left)\b|\bwhats next\b|\bwhat else\b|\bwhat (should|shall|can) we (do|build) next\b/i;
export const FRICTION = /\b(why (are|is|did|does|do|was|were) (we|you|it|this|that|there)\b|(doesn'?t|does not|didn'?t|isn'?t|is not|won'?t|can'?t|couldn'?t|wasn'?t) (work|render|load|show|start|open|run|see|find|connect)\w*|not (working|loading|rendering|showing)|stuck|broken|still (not|doesn|isn|fail|see|show|load|ask)|i thought (i|we|you|it|this)|all over the place|lines .{0,20}all over|nothing happen|again\?|keeps? (asking|failing|happening|breaking))/i;
/** How many such messages, in this repo's sessions, before it's a pattern rather than a moment. */
export const INTENT_MIN = 3;

function intentMoments(sessions: Session[]): Moment[] {
  const groups: Record<"confused" | "friction", { text: string; before: string; session: string; tool: string; ts: string }[]> = { confused: [], friction: [] };
  for (const s of sessions) {
    let prev = "";
    for (const e of s.events) {
      if (e.k === "agent") { prev = e.text; continue; }
      if (e.k !== "typed") continue;
      const t = e.text.trim();
      if (t.length > 600 || t.length < 8) { prev = ""; continue; }
      const kind = CONFUSED.test(t) && !NOT_CONFUSED.test(t) ? "confused" : FRICTION.test(t) ? "friction" : null;
      if (kind) groups[kind].push({ text: t, before: prev.replace(/\s+/g, " ").trim(), session: s.id, tool: s.tool, ts: e.ts });
      prev = "";
    }
  }
  const out: Moment[] = [];
  for (const kind of ["confused", "friction"] as const) {
    const items = groups[kind];
    if (items.length < INTENT_MIN) continue;
    const last = items.at(-1)!;
    out.push({
      signal: kind,
      text: redact(kind === "confused"
        ? `The engineer asked what something meant, or said they didn't follow, ${items.length} times`
        : `The engineer reported something not working or not as expected, ${items.length} times`),
      // What the agent said before each: the writer looks for what they have in common.
      context: redact(items.slice(-8).map((i) => `Agent said: "${i.before.slice(0, 220)}" → engineer: "${i.text.slice(0, 200)}"`).join("\n")),
      quotes: items.slice(-3).map((i) => ({ tool: i.tool, session: i.session, ts: i.ts, quote: redact(i.text).slice(0, 240) })),
      sessions: new Set(items.map((i) => i.session)).size, days: new Set(items.map((i) => i.ts.slice(0, 10))).size,
      wordings: new Set(items.map((i) => norm(i.text))).size, tools: [...new Set(items.map((i) => i.tool))], last: last.ts,
    });
  }
  return out;
}

function explainedMoments(sessions: Session[]): Moment[] {
  const out: Moment[] = [];
  for (const s of sessions) for (const e of s.events) {
    if (e.k !== "typed" || !isExplanation(e.text)) continue;
    const text = redact(e.text).slice(0, 3000);
    out.push({ signal: "explained", text, quotes: [{ tool: s.tool, session: s.id, ts: e.ts, quote: text.slice(0, 240) }], sessions: 1, days: 1, wordings: 1, tools: [s.tool], last: e.ts });
  }
  return out;
}

/** A limit or offset that pages through output: `| head -50`, `-n 20`, `--max-count=5`, `LIMIT 10`. */
/**
 * A cap on how much output a command shows, counted from the start (or end): `| head -50`, `| tail -n 20`,
 * `--max-count=5`, `LIMIT 10`. Raising one re-shows everything the smaller one showed. Windows into the middle
 * (offsets, `sed -n 80,160p`) aren't here: reading a file in separate slices reads each part once.
 */
export const PAGE = /\|\s*(?:head|tail)\s+(?:-n\s*)?-?\d+|--max-count[= ]\d+|--lines[= ]\d+|\blimit[= ]\d+|\bLIMIT\s+\d+/gi;
/** Rough tokens in some output, about four characters each: what a repeat cost. */
export const tokensIn = (o: string) => Math.ceil(o.length / 4);
/** How many times in a row the same command must fail the same way to count as a loop. */
export const LOOP_MIN = 3;

function commandMoments(sessions: Session[]): Moment[] {
  const out: Moment[] = [];
  const returned = new Map<string, { cmd: string; err: string; hits: { session: string; tool: string; ts: string }[]; tokens: number }>();
  const stopped = new Map<string, { session: string; tool: string; ts: string }[]>();
  for (const s of sessions) {
    const count = new Map<string, number>(); const lastErr = new Map<string, string>(); const between = new Map<string, string[]>();
    const failTokens = new Map<string, number>();
    // Loops: the same command failing the same way in a row. Kept if the session moved on without fixing it.
    const run = new Map<string, { err: string; n: number; tokens: number; ts: string }>();
    const loops = new Map<string, { err: string; n: number; tokens: number; ts: string }>();
    // Re-fetches: one command re-run with different limits, each time re-reading output the last run cut off.
    // Keyed on the whole command with its caps taken out: only the very same command, re-run with a bigger cap, counts.
    const pages = new Map<string, { key: string; raws: Set<string>; runs: { cmd: string; output: string }[]; ts: string }>();
    // The runs behind each loop and each failure, kept as evidence.
    const tries = new Map<string, { cmd: string; output: string }[]>();
    for (const e of s.events) {
      if (e.k !== "cmd") continue;
      if (e.stopped) {
        const key = normCommand(e.cmd);
        if (key) stopped.set(key, [...(stopped.get(key) ?? []), { session: s.id, tool: s.tool, ts: e.ts }]);
        continue;
      }
      if (!e.failed && new RegExp(PAGE.source, "i").test(e.cmd)) {
        const whole = e.cmd.replace(PAGE, "").replace(/\s+/g, " ").trim();
        const p = pages.get(whole) ?? { key: normCommand(e.cmd.replace(PAGE, "")), raws: new Set<string>(), runs: [], ts: e.ts };
        if (!p.raws.has(e.cmd.trim())) { p.raws.add(e.cmd.trim()); p.runs.push({ cmd: e.cmd, output: e.output }); }
        p.ts = e.ts; pages.set(whole, p);
      }
      const key = normCommand(e.cmd);
      if (!key || BENIGN.test(key)) continue;
      if (e.failed) {
        tries.set(key, [...(tries.get(key) ?? []), { cmd: e.cmd, output: e.output }].slice(-6));
        const err = errorLine(e.output);
        const r = run.get(key);
        const next = r && r.err === err ? { err, n: r.n + 1, tokens: r.tokens + tokensIn(e.output), ts: e.ts } : { err, n: 1, tokens: 0, ts: e.ts };
        run.set(key, next);
        if (next.n >= LOOP_MIN && next.n > (loops.get(key)?.n ?? 0)) loops.set(key, next);
      } else { run.delete(key); loops.delete(key); }
      for (const [k, list] of between) if (k !== key && list.length < 5) list.push(key);
      if (e.failed) {
        const err = errorLine(e.output);
        const k = `${key} :: ${err}`;
        const r = returned.get(k) ?? { cmd: key, err, hits: [], tokens: 0 };
        if (r.hits.length) r.tokens += tokensIn(e.output);
        r.hits.push({ session: s.id, tool: s.tool, ts: e.ts }); returned.set(k, r);
        if (count.get(key)) failTokens.set(key, (failTokens.get(key) ?? 0) + tokensIn(e.output));
        count.set(key, (count.get(key) ?? 0) + 1); lastErr.set(key, err);
        if (!between.has(key)) between.set(key, []);
      } else if ((count.get(key) ?? 0) >= 2) {
        const steps = between.get(key) ?? [];
        out.push({
          signal: "failure_then_fix", text: redact(`\`${key}\` failed with "${lastErr.get(key)}"`),
          context: redact(`Commands run between the failures and the success: ${steps.join("; ") || "none"}`),
          quotes: [...(tries.get(key) ?? []).slice(-2), { cmd: e.cmd, output: e.output }].map((t) => ({ tool: s.tool, session: s.id, ts: e.ts, quote: shown(t.cmd, t.output) })),
          sessions: 1, days: 1, wordings: 1, tools: [s.tool], last: e.ts, wasted: failTokens.get(key) ?? 0,
        });
        count.delete(key); between.delete(key); failTokens.delete(key); tries.delete(key);
      }
    }
    for (const [key, l] of loops) out.push({
      signal: "loop", text: redact(`\`${key}\` failed ${l.n} times in a row with "${l.err}", and the session moved on without fixing it`),
      context: `The repeats cost about ${l.tokens} tokens of output.`,
      quotes: (tries.get(key) ?? []).slice(-3).map((t) => ({ tool: s.tool, session: s.id, ts: l.ts, quote: shown(t.cmd, t.output) })),
      sessions: 1, days: 1, wordings: 1, tools: [s.tool], last: l.ts, wasted: l.tokens,
    });
    for (const p of pages.values()) {
      const key = p.key;
      if (p.raws.size < LOOP_MIN) continue;
      // Checked against what was printed, not guessed from the commands: a run counts as re-read only if a later run showed it again.
      const reread = p.runs.filter((r, i) => p.runs.slice(i + 1).some((later) => repeats(r.output, later.output)));
      if (reread.length < LOOP_MIN - 1) continue;
      out.push({
        signal: "refetch", text: redact(`\`${key}\` was run ${p.raws.size} times with different limits, and ${reread.length} of the runs printed output a later run printed again`),
        context: `About ${reread.reduce((a, r) => a + tokensIn(r.output), 0)} tokens of output were read twice.`,
        quotes: p.runs.slice(-3).map((r) => ({ tool: s.tool, session: s.id, ts: p.ts, quote: shown(r.cmd, r.output) })),
        sessions: 1, days: 1, wordings: 1, tools: [s.tool], last: p.ts, wasted: reread.reduce((a, r) => a + tokensIn(r.output), 0),
      });
    }
  }
  // Commands the engineer stopped more than once: a sign the agent keeps reaching for something they don't want.
  for (const [key, hits] of stopped) {
    if (hits.length < 2) continue;
    const last = hits.at(-1)!;
    out.push({
      signal: "stopped", text: redact(`The engineer stopped \`${key}\` ${hits.length} times before it ran`),
      quotes: hits.slice(-3).map((h) => ({ ...h, quote: redact(`stopped: ${key}`).slice(0, 240) })),
      sessions: new Set(hits.map((h) => h.session)).size, days: new Set(hits.map((h) => h.ts.slice(0, 10))).size, wordings: 1, tools: [...new Set(hits.map((h) => h.tool))], last: last.ts,
    });
  }
  for (const r of returned.values()) {
    const ss = new Set(r.hits.map((h) => h.session));
    if (ss.size < 3) continue;
    const last = r.hits.at(-1)!;
    out.push({
      signal: "mistake_returned", text: redact(`\`${r.cmd}\` keeps failing with "${r.err}"`),
      quotes: [{ tool: last.tool, session: last.session, ts: last.ts, quote: redact(`${r.cmd}: ${r.err}`).slice(0, 240) }],
      sessions: ss.size, days: new Set(r.hits.map((h) => h.ts.slice(0, 10))).size, wordings: 1, tools: [...new Set(r.hits.map((h) => h.tool))], last: last.ts, wasted: r.tokens,
    });
  }
  return out;
}
