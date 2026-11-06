import { createInterface } from "node:readline/promises";
import { isPaused, settings } from "../config.js";
import { loadEmbedder, modelCached, MODEL_SIZE, MODEL_SOURCE } from "../embed/model.js";
import { learnRepo } from "../learn/pipeline.js";
import { pickWriter } from "../learn/writer.js";
import { scanLogs } from "../logs/discover.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { ensureRepo } from "../store/lessons.js";
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
    console.log(`Found ${scan.files.claude} Claude Code and ${scan.files.codex} Codex log files.`);
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
    const r = await learnRepo(db, repo, sessions, { embed, writer, cutoff: cfg.similarityCutoff, minSessions: cfg.minSessions });
    if (!opts.auto) console.log(`${repo}: ${JSON.stringify(r.moments)} moments, ${r.newLessons} new lesson(s), ${r.discarded} discarded as noise, ${r.addedEvidence} added evidence.`);
    for (const s of sessions) if (s.unknown) { await db.execute({ sql: "INSERT OR REPLACE INTO scan_counts (repo_id,tool,client_version,scanned_at,unknown_records) VALUES (?,?,?,?,?)", args: [repo, s.tool, s.clientVersion, new Date().toISOString(), s.unknown] }); }
  }
  await db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES ('last_learn',?)", args: [new Date().toISOString()] });
  if (!opts.auto) {
    const unknown = scan.sessions.reduce((n, s) => n + s.unknown, 0);
    if (unknown) console.log(`${unknown} log record(s) had a structure muninn doesn't recognise, so a format may have changed.`);
    await review(db, here);
  }
}
