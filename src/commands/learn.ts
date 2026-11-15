import { createInterface } from "node:readline/promises";
import { isPaused, settings } from "../config.js";
import { loadEmbedder, modelCached, MODEL_SIZE, MODEL_SOURCE } from "../embed/model.js";
import { learnRepo } from "../learn/pipeline.js";
import { pickRunner, pickWriter } from "../learn/writer.js";
import { latestHandoff, makeHandoff, needsHandoff } from "../handoff/handoff.js";
import { scanLogs } from "../logs/discover.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { ensureRepo, foldDuplicates, overlappingLive } from "../store/lessons.js";
import { review } from "./review.js";

export async function learn(opts: { allRepos?: boolean; auto?: boolean }) {
  if (opts.auto && isPaused()) return;
  const cfg = settings();
  const here = opts.allRepos ? null : repoIdentity(process.cwd());
  if (!opts.allRepos && !here) { console.error("This folder is not in a git repo. Run it inside one, or use --all-repos."); process.exitCode = 1; return; }

  const scan = scanLogs();
  const repos = here ? (scan.byRepo.has(here) ? [here] : []) : [...scan.byRepo.keys()];
  const count = repos.reduce((n, r) => n + scan.byRepo.get(r)!.length, 0);
  if (!opts.auto) {
    console.log(`Found ${scan.files.claude} Claude Code, ${scan.files.codex} Codex and ${scan.files.cursor} Cursor log files.`);
    console.log(`Reading ${count} session(s) in ${repos.length} repo(s). ${scan.missingFolder} session(s) skipped: their folder is gone or not in a repo.`);
  }
  if (!count) { if (!opts.auto) console.log("No sessions found for this repo. Try --all-repos."); return; }

  const writer = pickWriter();
  if (!opts.auto) console.log(writer ? `Redacted excerpts will go to your ${writer.name} client to write lessons.` : "No Claude Code or Codex client found, so only repeated instructions can become lessons.");

  if (!modelCached()) {
    if (opts.auto) return;
    if (process.stdin.isTTY) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const a = await rl.question(`muninn needs a one-time download of a local embedding model, ${MODEL_SIZE}, from ${MODEL_SOURCE}. It runs on this machine and spots instructions that mean the same thing. Download it (y/n)? `);
      rl.close();
      if (!a.trim().toLowerCase().startsWith("y")) { console.log("Stopped. The model is needed to compare what you typed."); return; }
    }
  }
  const embed = await loadEmbedder();
  const db = await openDb();
  for (const repo of repos) {
    const sessions = scan.byRepo.get(repo)!;
    await ensureRepo(db, repo, sessions[0]!.cwd);
    if (sessions.length < cfg.minSessions && !opts.auto) console.log(`${repo}: only ${sessions.length} session(s), which may be too few to find repeats.`);
    const folded = await foldDuplicates(db, repo);
    const r = await learnRepo(db, repo, sessions, { embed, writer, cutoff: cfg.similarityCutoff, minSessions: cfg.minSessions, notesPerRun: cfg.notesPerRun });
    if (!opts.auto) {
      const total = Object.values(r.moments).reduce((a, b) => a + b, 0);
      console.log(`${repo}: ${total} moments. ${r.known} already known (evidence added), ${r.newLessons} new lesson(s), ${r.discarded} discarded as noise.`);
      if (folded) console.log(`  Folded ${folded} duplicate proposed lesson(s) into the lesson they repeat.`);
      for (const [a, b] of await overlappingLive(db, repo)) console.log(`  Live lessons ${a.slice(0, 8)} and ${b.slice(0, 8)} come from the same quotes. Retire one with "muninn retire <id>".`);
    }
    for (const s of sessions) if (s.unknown) { await db.execute({ sql: "INSERT OR REPLACE INTO scan_counts (repo_id,tool,client_version,scanned_at,unknown_records) VALUES (?,?,?,?,?)", args: [repo, s.tool, s.clientVersion, new Date().toISOString(), s.unknown] }); }
  }
  // Handoffs for recent sessions that ended without the SessionEnd hook, such as Cursor's.
  const runner = writer ? pickRunner() : null;
  if (runner && !isPaused()) {
    const have = new Set((await db.execute("SELECT session FROM handoffs")).rows.map((r) => String(r.session)));
    let made = 0;
    for (const repo of repos) for (const s of needsHandoff(scan.byRepo.get(repo)!, have, 2)) {
      if (made >= cfg.handoffsPerRun) break;
      const branch = s.branch ?? null;
      const newer = branch ? await latestHandoff(db, repo, branch, cfg.handoffDays) : null;
      if (newer && newer.created_at >= (s.events.at(-1)?.ts ?? "")) continue;
      try { if (await makeHandoff(db, s, runner)) made++; } catch { /* a failed handoff shouldn't stop learning */ }
    }
    if (made && !opts.auto) console.log(`Wrote ${made} handoff(s) for recent sessions. See them with "muninn handoff --list".`);
  }
  await db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES ('last_learn',?)", args: [new Date().toISOString()] });
  if (!opts.auto) {
    const unknown = scan.sessions.reduce((n, s) => n + s.unknown, 0);
    if (unknown) console.log(`${unknown} log record(s) had a structure muninn doesn't recognise, so a format may have changed.`);
    await review(db, here);
  }
}
