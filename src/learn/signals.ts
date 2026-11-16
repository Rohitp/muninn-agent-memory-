import { redact } from "../privacy/redact.js";
import { cosine, type Embed } from "../embed/model.js";
import type { Session } from "../logs/types.js";

export type Signal = "repeat" | "correction" | "failure_then_fix" | "mistake_returned" | "explained" | "loop" | "refetch" | "stopped";
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
  c = (c.split("\n")[0] ?? "").replace(/^\s*cd\s+\S+\s*&&\s*/, "").replace(/^(\w+=\S+\s+)+/, "").trim();
  return c.replace(/\/[\w.@/-]+/g, "<path>").replace(/\b[0-9a-f]{7,}\b/g, "<id>").replace(/\b\d+\b/g, "<n>").slice(0, 90);
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

export async function findMoments(sessions: Session[], embed: Embed, opts: { cutoff: number; minSessions: number }): Promise<Moment[]> {
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
    if (m.days >= 3 || (m.sessions >= opts.minSessions && m.wordings >= 2) || inOneLong) moments.push(m);
  }
  for (const c of cluster(corrections, vectors, opts.cutoff)) {
    const m = toMoment("correction", c);
    m.context = c.items.at(-1)?.before ? redact(c.items.at(-1)!.before!) : undefined;
    if (m.sessions >= 2 || (c.items.length >= 2 && spanHours(c) >= 1)) moments.push(m);
  }
  moments.push(...commandMoments(sessions), ...explainedMoments(sessions));
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
export const PAGE = /\|\s*(?:head|tail)\s+-n?\s*\d+|\s-n\s*\d+|--max-count[= ]\d+|--lines[= ]\d+|\bhead\s+-\d+|\b(?:limit|offset)[= ]\d+|\bLIMIT\s+\d+|\bOFFSET\s+\d+/gi;
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
    const pages = new Map<string, { raws: Set<string>; tokens: number; ts: string }>();
    for (const e of s.events) {
      if (e.k !== "cmd") continue;
      if (e.stopped) {
        const key = normCommand(e.cmd);
        if (key) stopped.set(key, [...(stopped.get(key) ?? []), { session: s.id, tool: s.tool, ts: e.ts }]);
        continue;
      }
      if (!e.failed && new RegExp(PAGE.source, "i").test(e.cmd)) {
        const base = normCommand(e.cmd.replace(PAGE, ""));
        const p = pages.get(base) ?? { raws: new Set<string>(), tokens: 0, ts: e.ts };
        p.raws.add(e.cmd.trim()); p.tokens += tokensIn(e.output); p.ts = e.ts; pages.set(base, p);
      }
      const key = normCommand(e.cmd);
      if (!key || BENIGN.test(key)) continue;
      if (e.failed) {
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
          quotes: [{ tool: s.tool, session: s.id, ts: e.ts, quote: redact(`${key} failed ${count.get(key)} times: ${lastErr.get(key)}`).slice(0, 240) }],
          sessions: 1, days: 1, wordings: 1, tools: [s.tool], last: e.ts, wasted: failTokens.get(key) ?? 0,
        });
        count.delete(key); between.delete(key); failTokens.delete(key);
      }
    }
    for (const [key, l] of loops) out.push({
      signal: "loop", text: redact(`\`${key}\` failed ${l.n} times in a row with "${l.err}", and the session moved on without fixing it`),
      context: `The repeats cost about ${l.tokens} tokens of output.`,
      quotes: [{ tool: s.tool, session: s.id, ts: l.ts, quote: redact(`${key} failed ${l.n} times in a row: ${l.err}`).slice(0, 240) }],
      sessions: 1, days: 1, wordings: 1, tools: [s.tool], last: l.ts, wasted: l.tokens,
    });
    for (const [key, p] of pages) {
      if (p.raws.size < LOOP_MIN) continue;
      const examples = [...p.raws].slice(0, 3).map((r) => r.slice(0, 80));
      out.push({
        signal: "refetch", text: redact(`\`${key}\` was run ${p.raws.size} times with different limits, each time re-reading output the previous run had cut off`),
        context: redact(`Runs: ${examples.join(" ; ")}. About ${p.tokens} tokens of output in all.`),
        quotes: [{ tool: s.tool, session: s.id, ts: p.ts, quote: redact(`${key} re-run ${p.raws.size} times with different limits`).slice(0, 240) }],
        // The first run's output was needed; the re-reads were the waste.
        sessions: 1, days: 1, wordings: 1, tools: [s.tool], last: p.ts, wasted: Math.round(p.tokens * (p.raws.size - 1) / p.raws.size),
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
