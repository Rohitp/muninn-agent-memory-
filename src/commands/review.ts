import type { Client } from "@libsql/client";
import { createInterface, type Interface } from "node:readline/promises";
import { settings } from "../config.js";
import { cosine } from "../embed/model.js";
import { pickToShow } from "../learn/pipeline.js";
import { combine, decide, getLesson, keywordsInUse, lessonsForKeyword, lessonVectors, listLessons, markShown, type Lesson } from "../store/lessons.js";

const STOP = new Set(["about", "after", "always", "before", "because", "never", "should", "their", "there", "these", "those", "using", "which", "would", "could", "answer", "answers", "agent", "lesson", "first", "other", "while", "without", "instead", "every", "where"]);
/** A keyword the engineer would likely type for this lesson: a command or path in backticks, or its most specific word. */
export function suggestKeyword(text: string): string {
  const tick = text.match(/`([^`]+)`/)?.[1]?.split(/[\s/]+/).find((w) => /^[\w.-]{3,}$/.test(w) && !w.startsWith("-"));
  if (tick) return tick.toLowerCase();
  const words = text.toLowerCase().match(/[a-z][a-z0-9_-]{4,}/g) ?? [];
  return words.filter((w) => !STOP.has(w)).sort((a, b) => b.length - a.length)[0] ?? "";
}
const HOW = `
  How kept lessons reach your agent, once you run "muninn install":
    a  Always-on: sent at the start of every session in this repo, and again after compaction.
       Use it for things that apply to most work here.
    k  Keyword: sent when your prompt contains a word you choose, or a failed command does.
       Example: keyword "estimate" sends the lesson with "run the estimate tests".
       Use it for one task, test suite or script.
    n  Neither: kept and searchable, never sent automatically.
  You can change this later with "muninn edit <id>".`;

async function similar(db: Client, l: Lesson): Promise<{ lesson: Lesson; score: number } | null> {
  if (!l.repo_id) return null;
  const all = await lessonVectors(db, l.repo_id);
  const me = all.find((x) => x.id === l.id)?.vector;
  if (!me) return null;
  let best: { id: string; score: number } | null = null;
  for (const x of all) {
    if (x.id === l.id || !x.vector || !["proposed", "live"].includes(x.status)) continue;
    const score = cosine(me, x.vector);
    if (score >= 0.75 && (!best || score > best.score)) best = { id: x.id, score };
  }
  const lesson = best ? await getLesson(db, best.id) : null;
  return lesson && best ? { lesson, score: best.score } : null;
}

async function chooseRoute(db: Client, rl: Interface, l: Lesson, explained: { done: boolean }) {
  if (!explained.done) { console.log(HOW); explained.done = true; }
  const route = (await rl.question("  Deliver: (a)lways-on, (k)eyword, or (n)either? ")).trim().toLowerCase();
  if (route.startsWith("a")) return { alwaysOn: true, triggers: [] as string[] };
  if (!route.startsWith("k")) { console.log("  Kept. It's searchable, but won't be sent automatically."); return { alwaysOn: false, triggers: [] as string[] }; }
  const used = await keywordsInUse(db, l.repo_id);
  if (used.length) console.log(`  Keywords in use: ${used.map((u) => `${u.pattern} (${u.lessons})`).join(", ")}`);
  const suggestion = suggestKeyword(l.text);
  const typed = (await rl.question(`  Keyword${suggestion ? ` [${suggestion}]` : ""}: `)).trim();
  const keyword = (typed || suggestion).toLowerCase();
  if (!keyword) return { alwaysOn: false, triggers: [] as string[] };
  const sharing = await lessonsForKeyword(db, l.repo_id, keyword);
  const max = settings().maxPerDelivery;
  if (sharing.length >= max) {
    console.log(`  "${keyword}" already has ${sharing.length} lessons, and only ${max} are sent per prompt. Always-on lessons go first, then longer keywords, then newer ones.`);
    console.log(`  These ${sharing.length + 1 - max} would be left out: ${sharing.slice(max - 1).map((x) => `"${x.text.slice(0, 50)}"`).join(", ")}`);
    if (!(await rl.question("  Use it anyway (y/n)? ")).trim().toLowerCase().startsWith("y")) return chooseRoute(db, rl, l, explained);
  }
  return { alwaysOn: false, triggers: [keyword] };
}

export async function review(db: Client, repo: string | null, lessons?: Lesson[]) {
  const all = lessons ?? (await listLessons(db, { repo, status: "proposed" }));
  const shown = pickToShow(all, settings().shownPerRun);
  if (!shown.length) { console.log("No lessons waiting for review."); return; }
  if (!process.stdin.isTTY) {
    console.log(`${all.length} lessons waiting. Not a terminal, so nothing changes. Top ${shown.length}:`);
    for (const l of shown) console.log(`- [${l.signal}] ${l.text}`);
    return;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const explained = { done: false };
  let i = 0;
  for (const first of shown) {
    i++;
    const l = await getLesson(db, first.id);
    if (!l || l.status !== "proposed") continue;
    const ev = await db.execute({ sql: "SELECT tool,quote FROM evidence WHERE lesson_id=? LIMIT 3", args: [l.id] });
    console.log(`\n[${i}/${shown.length}] ${l.text}\n  ${l.signal}, ${l.sessions} session(s)`);
    for (const e of ev.rows) console.log(`  ${e.tool}: ${e.quote}`);
    await markShown(db, l.id);
    const sim = await similar(db, l);
    if (sim) console.log(`  Similar to a ${sim.lesson.status} lesson: "${sim.lesson.text.slice(0, 140)}"`);
    const a = (await rl.question(`  (k)eep, (e)dit, ${sim ? "(c)ombine, " : ""}(r)eject, (l)ater? `)).trim().toLowerCase();
    if (a.startsWith("r")) { await decide(db, l.id, { status: "rejected" }); continue; }
    let text: string | undefined;
    if (a.startsWith("c") && sim) {
      text = (await rl.question("  Combined text (Enter keeps this lesson's text): ")).trim() || undefined;
      await combine(db, l.id, sim.lesson.id, text);
      console.log("  Combined. The other lesson is retired, and its evidence and keywords moved here.");
    } else if (a.startsWith("e")) {
      text = (await rl.question("  New text: ")).trim() || undefined;
    } else if (!a.startsWith("k")) continue;
    const news = (await rl.question("  Was this news to you (y/n)? ")).trim().toLowerCase().startsWith("y");
    let global: boolean | undefined;
    if (l.suggested_scope === "global" && l.scope !== "global") global = !(await rl.question("  This looks like it applies to any repo. Make it global (Y/n)? ")).trim().toLowerCase().startsWith("n");
    const route = await chooseRoute(db, rl, l, explained);
    await decide(db, l.id, { status: "live", ...(text ? { text } : {}), news, ...(global !== undefined ? { global } : {}), alwaysOn: route.alwaysOn, triggers: route.triggers });
  }
  rl.close();
}
