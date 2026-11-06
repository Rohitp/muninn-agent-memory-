import type { Client } from "@libsql/client";
import { createInterface } from "node:readline/promises";
import { settings } from "../config.js";
import { pickToShow } from "../learn/pipeline.js";
import { decide, listLessons, markShown, type Lesson } from "../store/lessons.js";

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
  let i = 0;
  for (const l of shown) {
    i++;
    const ev = await db.execute({ sql: "SELECT tool,quote FROM evidence WHERE lesson_id=? LIMIT 3", args: [l.id] });
    console.log(`\n[${i}/${shown.length}] ${l.text}\n  ${l.signal}, ${l.sessions} session(s)`);
    for (const e of ev.rows) console.log(`  ${e.tool}: ${e.quote}`);
    await markShown(db, l.id);
    const a = (await rl.question("  (k)eep, (e)dit, (r)eject, (l)ater? ")).trim().toLowerCase();
    if (a.startsWith("r")) { await decide(db, l.id, { status: "rejected" }); continue; }
    if (!a.startsWith("k") && !a.startsWith("e")) continue;
    const text = a.startsWith("e") ? (await rl.question("  New text: ")).trim() : undefined;
    const news = (await rl.question("  Was this news to you (y/n)? ")).trim().toLowerCase().startsWith("y");
    const route = (await rl.question("  Deliver: (a)lways-on, (k)eyword, or (n)either? ")).trim().toLowerCase();
    const alwaysOn = route.startsWith("a");
    const keyword = route.startsWith("k") ? (await rl.question("  Keyword: ")).trim() : "";
    if (!alwaysOn && !keyword) console.log("  This lesson is searchable, but it won't be delivered automatically.");
    await decide(db, l.id, { status: "live", ...(text ? { text } : {}), news, alwaysOn, triggers: keyword ? [keyword] : [] });
  }
  rl.close();
}
