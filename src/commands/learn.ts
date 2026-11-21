import { createInterface } from "node:readline/promises";
import { isPaused, settings } from "../config.js";
import { loadEmbedder, modelCached, MODEL_SIZE, MODEL_SOURCE } from "../embed/model.js";
import { learnRepo } from "../learn/pipeline.js";
import { pickRunner, pickWriter, saveUsage } from "../learn/writer.js";
import { fillExplanations } from "../learn/explain.js";
import { latestHandoff, makeHandoff, needsHandoff } from "../handoff/handoff.js";
import { scanLogs } from "../logs/discover.js";
import { repoIdentity } from "../repo/identity.js";
import { openDb } from "../store/db.js";
import { ensureRepo, foldDuplicates, overlappingLive } from "../store/lessons.js";
import { adoptRepo } from "../repo/adopt.js";
import { review } from "./review.js";

export async function learn(opts: { allRepos?: boolean; auto?: boolean; noReview?: boolean }): Promise<number> {
  if (opts.auto && isPaused()) return 0;
  const cfg = settings();
  const here = opts.allRepos ? null : repoIdentity(process.cwd());
  if (!opts.allRepos && !here) { console.error("This folder is not in a git repo. Run it inside one, or use --all-repos."); process.exitCode = 1; return 0; }

  const scan = scanLogs();
  const { ignoredRepos } = await import("../store/ignore.js");
  const ignored = await ignoredRepos(await openDb());
  const repos = (here ? (scan.byRepo.has(here) ? [here] : []) : [...scan.byRepo.keys()]).filter((r) => !ignored.has(r));
  const count = repos.reduce((n, r) => n + scan.byRepo.get(r)!.length, 0);
  if (!opts.auto) {
    console.log(`Found ${scan.files.claude} Claude Code, ${scan.files.codex} Codex, ${scan.files.cursor} Cursor and ${scan.files.antigravity} Antigravity log files.`);
    console.log(`Reading ${count} session(s) in ${repos.length} repo(s).${scan.missingFolder ? ` ${scan.missingFolder} skipped because they didn't run inside a git repo (or the folder is gone). muninn learns per repo, so run your agents inside a project that's a git repo.` : ""}`);
  }
  if (!count) { if (!opts.auto) console.log(opts.allRepos ? "Nothing to learn from yet. Work with Claude Code, Codex or Cursor as usual; muninn checks your sessions on its own and suggestions appear in muninn ui." : "No sessions found for this repo yet. muninn checks on its own as you work."); return 0; }

  const writer = pickWriter();
  if (!opts.auto) console.log(writer ? `Redacted excerpts will go to your ${writer.name === "claude" ? "Claude Code" : "Codex"} to write lessons.` : "No Claude Code or Codex client found, so only repeated instructions can become lessons.");

  if (!modelCached()) {
    if (opts.auto) return 0;
    if (process.stdin.isTTY) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const a = await rl.question(`muninn needs a one-time download of a local embedding model, ${MODEL_SIZE}, from ${MODEL_SOURCE}. It runs on this machine and spots instructions that mean the same thing. Download it (y/n)? `);
      rl.close();
      if (!a.trim().toLowerCase().startsWith("y")) { console.log("Stopped. The model is needed to compare what you typed."); return 0; }
    }
  }
  const embed = await loadEmbedder();
  const db = await openDb();
  for (const repo of repos) {
    const sessions = scan.byRepo.get(repo)!;
    await adoptRepo(db, repo, sessions[0]!.cwd);
    await ensureRepo(db, repo, sessions[0]!.cwd);
    // Marks the repo as scanned, so a session ending in a brand-new repo can trigger its first scan straight away.
    await db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)", args: [`scanned:${repo}`, new Date().toISOString()] });
    if (sessions.length < cfg.minSessions && !opts.auto) console.log(`${repo}: only ${sessions.length} session(s), which may be too few to find repeats.`);
    // Lines in the repo's CLAUDE.md that may be out of date. Cheap: no model calls.
    try {
      const { checkAndSave } = await import("../memory/stale.js");
      const n = await checkAndSave(db, repo, sessions);
      if (n && !opts.auto) console.log(`${repo}: ${n} line(s) in CLAUDE.md may be out of date. See them in muninn ui, or run "muninn memory".`);
    } catch { /* a repo muninn can't read shouldn't stop the scan */ }
    const folded = await foldDuplicates(db, repo);
    const r = await learnRepo(db, repo, sessions, { embed, writer, cutoff: cfg.similarityCutoff, minSessions: cfg.minSessions, notesPerRun: cfg.notesPerRun });
    await saveUsage(db, writer?.runner ?? null, "lesson writing");
    // Changes to propose: "ask first" rules from commands you keep stopping, and skills from steps that repeat.
    try {
      const p = await import("../propose/index.js");
      const { repoRoot } = await import("../deliver/local-file.js");
      let guards = 0;
      for (const g of p.guardProposals(repo, sessions, await repoRoot(db, repo))) if (await p.propose(db, g)) guards++;
      const skillRunner = writer ? pickRunner("background") : null;
      const skills = await p.proposeSkills(db, repo, sessions, skillRunner);
      await saveUsage(db, skillRunner, "skill drafts");
      if ((guards || skills) && !opts.auto) console.log(`  Proposed ${[guards ? `${guards} "ask first" rule(s)` : "", skills ? `${skills} skill(s)` : ""].filter(Boolean).join(" and ")}. Apply or dismiss them in muninn ui.`);
    } catch (e) { if (!opts.auto) console.log(`  Couldn't look for changes to propose: ${e instanceof Error ? e.message : String(e)}`); }
    if (!opts.auto) {
      const total = Object.values(r.moments).reduce((a, b) => a + b, 0);
      console.log(`${repo}: ${total} moments. ${r.known} already known (evidence added), ${r.newLessons} new lesson(s), ${r.discarded} discarded as noise.`);
      if (folded) console.log(`  Folded ${folded} duplicate proposed lesson(s) into the lesson they repeat.`);
      for (const [a, b] of await overlappingLive(db, repo)) console.log(`  Live lessons ${a.slice(0, 8)} and ${b.slice(0, 8)} come from the same quotes. Retire one with "muninn retire <id>".`);
    }
    for (const s of sessions) if (s.unknown) { await db.execute({ sql: "INSERT OR REPLACE INTO scan_counts (repo_id,tool,client_version,scanned_at,unknown_records) VALUES (?,?,?,?,?)", args: [repo, s.tool, s.clientVersion, new Date().toISOString(), s.unknown] }); }
  }
  // Cursor and Antigravity only hear lessons through rules files: turned on where you've used them, unless you turned them off.
  try {
    const { autoTurnOn, TOOL_NAME } = await import("../deliver/auto-rules.js");
    for (const t of await autoTurnOn(db, new Map(repos.map((r) => [r, scan.byRepo.get(r)!]))))
      if (!opts.auto) console.log(`${t.repo}: you've used ${TOOL_NAME[t.tool]} here, so its agent now gets your lessons as rules files (${t.files.join(", ")}). Turn this off with "muninn ${t.tool} off" or on the page.`);
  } catch { /* rules files are a convenience */ }
  // Every session kept as searchable exchanges, and the raw logs copied before the tool deletes them.
  try {
    const st = await import("../store/sessions.js");
    const archived = await st.archiveLogs(db);
    await st.indexPlan(db, embed);
    const all = repos.flatMap((r) => scan.byRepo.get(r)!);
    let shown = -1;
    const r = await st.indexSessions(db, all, embed, { ignored, onProgress: opts.auto ? undefined : (done, total) => { const pct = Math.floor((done / total) * 10); if (process.stdout.isTTY && pct !== shown) { shown = pct; process.stdout.write(`\rStoring sessions for search: ${done}/${total}`); } } });
    if (!opts.auto && process.stdout.isTTY && shown >= 0) process.stdout.write("\r\x1b[K");
    if (!opts.auto && (r.added || archived)) console.log(`Stored ${r.added} exchange(s) from ${r.sessions} session(s) for "muninn recall"${archived ? `, and kept a compressed copy of ${archived} log(s)` : ""}.`);
  } catch (e) { if (!opts.auto) console.log(`Couldn't store sessions this time: ${e instanceof Error ? e.message : String(e)}`); }
  const runner = writer ? pickRunner("background") : null;
  // A plain-English line and likely questions for each lesson, for the person and for search.
  if (runner) {
    try { const n = await fillExplanations(db, runner, embed); if (n && !opts.auto) console.log(`Wrote plain-English summaries for ${n} lesson(s).`); }
    catch (e) { if (!opts.auto) console.log(`Couldn't write summaries this time: ${e instanceof Error ? e.message : String(e)}`); }
    await saveUsage(db, runner, "plain lines");
    // A why for lessons kept before muninn wrote one with each lesson.
    try { const { explainWhy } = await import("../learn/why.js"); for (let i = 0; i < 4; i++) if (!(await explainWhy(db, runner))) break; }
    catch { /* asked again next time */ }
    await saveUsage(db, runner, "lesson reasons");
  }
  // Handoffs for recent sessions that ended without the SessionEnd hook, such as Cursor's.
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
    await saveUsage(db, runner, "handoff");
    // Fold any handoffs not yet in a plan (older ones, or ones whose update failed), then rewrite PLAN.md where it's on.
    const { applyPending, writePlanFile } = await import("../plan/plan.js");
    const folded = await applyPending(db, runner);
    await saveUsage(db, runner, "plan");
    // Group newly finished steps into outcomes, and give decisions their area and reason, for the page's history.
    try {
      const { branchesToGroup, groupHistory } = await import("../plan/history.js");
      let branches = 0;
      for (const repo of repos) for (const b of await branchesToGroup(db, repo)) { if (branches++ >= 6) break; await groupHistory(db, repo, b, runner).catch(() => 0); }
      await saveUsage(db, runner, "plan history");
    } catch { /* the history is a convenience */ }
    // How things relate: decisions to the outcomes they led to, outcomes to sessions and commits, sessions to files.
    try {
      const { buildLinks } = await import("../links/links.js");
      await buildLinks(db, repos.flatMap((r) => scan.byRepo.get(r)!));
      // Your Claude checks the links muninn can only guess at, a few batches per scan.
      const { confirmLinks } = await import("../links/confirm.js");
      for (let i = 0; i < 3; i++) { const c = await confirmLinks(db, runner); if (!c.motivates && !c.supersedes && !c.outside) break; }
      await saveUsage(db, runner, "link checks");
    } catch { /* links are a convenience */ }
    // Questions worth asking muninn, written from each repo's recent work, for the page's Ask box.
    try {
      const { refreshSuggestions } = await import("./suggestions.js");
      for (const repo of [...repos, null]) await refreshSuggestions(db, repo, runner).catch(() => []);
      await saveUsage(db, runner, "question suggestions");
    } catch { /* suggestions are a convenience */ }
    if (folded) for (const repo of repos) await writePlanFile(db, repo).catch(() => null);
    if (made && !opts.auto) console.log(`Wrote ${made} handoff(s) for recent sessions. See them with "muninn handoff --list".`);
  }
  await db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES ('last_learn',?)", args: [new Date().toISOString()] });
  if (!opts.auto) {
    const unknown = scan.sessions.reduce((n, s) => n + s.unknown, 0);
    if (unknown) console.log(`${unknown} log record(s) had a structure muninn doesn't recognise, so a format may have changed.`);
    if (!opts.noReview) await review(db, here);
  }
  const waiting = await db.execute({ sql: `SELECT count(*) n FROM lessons WHERE status='proposed' ${here ? "AND repo_id=?" : ""}`, args: here ? [here] : [] });
  return Number(waiting.rows[0]?.n ?? 0);
}
