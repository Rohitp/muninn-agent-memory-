import type { Client } from "@libsql/client";
import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import { cosine } from "../embed/model.js";
import type { Session } from "../logs/types.js";
import { repoIdentity } from "../repo/identity.js";
import { unvec } from "../store/sessions.js";

/**
 * A light ontology: the kinds of things muninn keeps and named relationships between them. Stored as rows in
 * one table; most links come from facts muninn already records, and "motivates" from similar meaning.
 *
 *   step      part_of    outcome   a finished step belongs to the outcome it was grouped into
 *   outcome   built_in   session   the sessions its steps came from
 *   outcome   ships_in   commit    the commit, PR or version it names
 *   decision  made_in    session   the session the decision was recorded from
 *   decision  motivates  outcome   work on the same branch, close in meaning, at or after the decision
 *   lesson    comes_from session   the sessions its evidence was seen in
 *   outcome   changes    file      files its commit changed, from git (precise, unlike a long session's files)
 *   session   touches    file      files the agent read, edited or searched (path relative to the repo)
 */
export type Kind = "step" | "outcome" | "decision" | "lesson" | "session" | "commit" | "file";
export type Rel = "part_of" | "built_in" | "ships_in" | "changes" | "made_in" | "motivates" | "comes_from" | "touches";
export const RELS: Record<Rel, { from: Kind; to: Kind; label: string; back: string }> = {
  part_of: { from: "step", to: "outcome", label: "Part of", back: "Steps" },
  built_in: { from: "outcome", to: "session", label: "Built in", back: "Built" },
  ships_in: { from: "outcome", to: "commit", label: "Ships in", back: "Shipped" },
  changes: { from: "outcome", to: "file", label: "Changed", back: "Changed by" },
  made_in: { from: "decision", to: "session", label: "Decided in", back: "Decisions made" },
  motivates: { from: "decision", to: "outcome", label: "Led to", back: "Because of" },
  comes_from: { from: "lesson", to: "session", label: "Learned in", back: "Lessons learned" },
  touches: { from: "session", to: "file", label: "Touched", back: "Touched in" },
};
/** How close in meaning a decision and an outcome's steps must be for "motivates", and how many outcomes per decision. */
export const MOTIVATES_MIN = 0.66;
const MOTIVATES_MAX = 3;

type Link = { src: [Kind, string]; rel: Rel; dst: [Kind, string]; how: "known" | "meaning"; score?: number; repo: string | null };
async function put(db: Client, l: Link) {
  await db.execute({ sql: "INSERT OR REPLACE INTO links (src_type,src_id,rel,dst_type,dst_id,how,score,repo_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)", args: [l.src[0], l.src[1], l.rel, l.dst[0], l.dst[1], l.how, l.score ?? null, l.repo, new Date().toISOString()] });
}

/**
 * Rebuilds the links muninn can work out: everything from recorded facts, plus "motivates" by meaning. Links you
 * made yourself are kept. Sessions, when given, add which files each touched.
 */
export async function buildLinks(db: Client, sessions: Session[] = []): Promise<Record<Rel, number>> {
  const count = Object.fromEntries(Object.keys(RELS).map((r) => [r, 0])) as Record<Rel, number>;
  await db.execute("DELETE FROM links WHERE how IN ('known','meaning') AND rel != 'touches'");
  const add = async (l: Link) => { await put(db, l); count[l.rel]++; };

  // Steps, outcomes, sessions and commits, from the grouped plan history.
  const steps = (await db.execute("SELECT p.id, p.outcome_id, p.session, p.repo_id FROM plan_items p WHERE p.outcome_id IS NOT NULL AND p.status != 'removed'")).rows;
  const builtIn = new Set<string>();
  for (const s of steps) {
    await add({ src: ["step", String(s.id)], rel: "part_of", dst: ["outcome", String(s.outcome_id)], how: "known", repo: String(s.repo_id) });
    const k = `${s.outcome_id}|${s.session}`;
    if (s.session && !builtIn.has(k)) { builtIn.add(k); await add({ src: ["outcome", String(s.outcome_id)], rel: "built_in", dst: ["session", String(s.session)], how: "known", repo: String(s.repo_id) }); }
  }
  const { repoRoot } = await import("../deliver/local-file.js");
  const roots = new Map<string, string | null>();
  for (const o of (await db.execute("SELECT id, ref, repo_id FROM plan_outcomes WHERE ref IS NOT NULL AND ref != ''")).rows) {
    const repo = String(o.repo_id), ref = String(o.ref);
    await add({ src: ["outcome", String(o.id)], rel: "ships_in", dst: ["commit", ref], how: "known", repo });
    // The files a commit changed, straight from git, when the ref is a commit this machine has.
    if (!/^[0-9a-f]{7,40}$/.test(ref)) continue;
    if (!roots.has(repo)) roots.set(repo, await repoRoot(db, repo));
    const root = roots.get(repo);
    if (!root) continue;
    let files: string[] = [];
    try { files = execFileSync("git", ["-C", root, "show", "--name-only", "--format=", ref], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }).split("\n").filter(Boolean); } catch { /* not in this clone */ }
    for (const f of files.slice(0, 60)) await add({ src: ["outcome", String(o.id)], rel: "changes", dst: ["file", f], how: "known", repo });
  }
  // Decisions: the session each came from, and the outcomes on its branch it most likely led to.
  const decisions = (await db.execute("SELECT id, session, repo_id, branch, created_at FROM plan_items WHERE kind='decision' AND status != 'removed'")).rows;
  const vec = async (id: string) => { const r = (await db.execute({ sql: "SELECT embedding FROM chunks WHERE id=?", args: [`plan:${id}`] })).rows[0]; return r?.embedding ? unvec(r.embedding) : null; };
  for (const d of decisions) {
    const id = String(d.id), repo = String(d.repo_id);
    if (d.session) await add({ src: ["decision", id], rel: "made_in", dst: ["session", String(d.session)], how: "known", repo });
    const dv = await vec(id);
    if (!dv) continue;
    const outcomes = (await db.execute({ sql: "SELECT id FROM plan_outcomes WHERE repo_id=? AND branch=? AND at >= ?", args: [repo, String(d.branch), String(d.created_at).slice(0, 10)] })).rows.map((r) => String(r.id));
    const scored: { id: string; s: number }[] = [];
    for (const o of outcomes) {
      let best = 0;
      for (const st of (await db.execute({ sql: "SELECT c.embedding FROM plan_items p JOIN chunks c ON c.id = 'plan:' || p.id WHERE p.outcome_id=? AND c.embedding IS NOT NULL", args: [o] })).rows) best = Math.max(best, cosine(dv, unvec(st.embedding)));
      if (best >= MOTIVATES_MIN) scored.push({ id: o, s: best });
    }
    for (const o of scored.sort((a, b) => b.s - a.s).slice(0, MOTIVATES_MAX)) await add({ src: ["decision", id], rel: "motivates", dst: ["outcome", o.id], how: "meaning", score: Math.round(o.s * 1000) / 1000, repo });
  }
  // Lessons: the sessions their evidence came from.
  for (const e of (await db.execute("SELECT DISTINCT e.lesson_id, e.session, l.repo_id FROM evidence e JOIN lessons l ON l.id = e.lesson_id WHERE l.status IN ('live','proposed')")).rows) {
    await add({ src: ["lesson", String(e.lesson_id)], rel: "comes_from", dst: ["session", String(e.session)], how: "known", repo: e.repo_id ? String(e.repo_id) : null });
  }
  // Files each session touched, relative to its repo. Only sessions read this time are redone.
  for (const s of sessions) {
    const repo = s.cwd ? repoIdentity(s.cwd) : null;
    if (!repo) continue;
    const files = new Set<string>();
    for (const e of s.events) if (e.k === "file" && !e.failed && e.tool !== "skill") { const r = relative(s.cwd, e.path); if (r && !r.startsWith("..")) files.add(r); }
    if (!files.size) continue;
    await db.execute({ sql: "DELETE FROM links WHERE src_type='session' AND src_id=? AND rel='touches'", args: [s.id] });
    for (const f of files) await add({ src: ["session", s.id], rel: "touches", dst: ["file", f], how: "known", repo });
  }
  return count;
}

/** One thing as a person reads it: what it is, a title, a date and where. */
export type Item = { kind: Kind; id: string; title: string; date: string | null; where: string | null };
async function describe(db: Client, kind: Kind, id: string): Promise<Item> {
  const one = async (sql: string) => (await db.execute({ sql, args: [id] })).rows[0];
  if (kind === "outcome") { const r = await one("SELECT title, at, branch FROM plan_outcomes WHERE id=?"); return { kind, id, title: r ? String(r.title) : id, date: r ? String(r.at) : null, where: r ? String(r.branch) : null }; }
  if (kind === "decision" || kind === "step") { const r = await one("SELECT coalesce(what, text) t, created_at, branch FROM plan_items WHERE id=?"); return { kind, id, title: r ? String(r.t) : id, date: r ? String(r.created_at) : null, where: r?.branch ? String(r.branch) : null }; }
  if (kind === "lesson") { const r = await one("SELECT text, updated_at FROM lessons WHERE id=?"); return { kind, id, title: r ? String(r.text) : id, date: r ? String(r.updated_at) : null, where: null }; }
  if (kind === "session") {
    const r = await one("SELECT min(ts) ts, tool, branch, (SELECT text FROM chunks c2 WHERE c2.session=c.session ORDER BY seq LIMIT 1) first FROM chunks c WHERE session=?");
    const first = r?.first ? String(r.first).split("\n")[0]!.replace(/^ENGINEER:\s*/, "").slice(0, 90) : null;
    return { kind, id, title: first ? `"${first}"` : `Session ${id.slice(0, 8)}`, date: r?.ts ? String(r.ts) : null, where: r?.branch ? String(r.branch) : null };
  }
  return { kind, id, title: id, date: null, where: null };
}

export type Related = { rel: Rel; label: string; items: Item[] }[];
/** What a thing links to and what links to it, grouped by relationship, each described for reading. */
export async function related(db: Client, kind: Kind, id: string, perRel = 8): Promise<Related> {
  const out: Related = [];
  const fwd = (await db.execute({ sql: "SELECT rel, dst_type t, dst_id i, score FROM links WHERE src_type=? AND src_id=? ORDER BY score DESC", args: [kind, id] })).rows;
  const back = (await db.execute({ sql: "SELECT rel, src_type t, src_id i, score FROM links WHERE dst_type=? AND dst_id=? ORDER BY score DESC", args: [kind, id] })).rows;
  for (const [rows, dir] of [[fwd, "label"], [back, "back"]] as const) {
    const byRel = new Map<Rel, string[][]>();
    for (const r of rows) { const rel = String(r.rel) as Rel; byRel.set(rel, [...(byRel.get(rel) ?? []), [String(r.t), String(r.i)]]); }
    for (const [rel, items] of byRel) out.push({ rel, label: RELS[rel][dir], items: await Promise.all(items.slice(0, perRel).map(([t, i]) => describe(db, t as Kind, i!))) });
  }
  return out;
}

/** The decision or outcome a plain description is most likely about, found by meaning and words. */
export async function findItem(db: Client, about: string, repo: string | null, embed: import("../embed/model.js").Embed): Promise<{ kind: "decision" | "outcome"; id: string } | null> {
  const { gatherSources } = await import("../commands/answer.js");
  // A decision among the top matches comes first: "what did X affect" starts from the decision, not the work.
  const found = (await gatherSources(db, about, repo, embed, { limit: 10 })).filter((s) => s.id.startsWith("plan:")).slice(0, 5);
  const decision = found.find((s) => s.kind === "decision");
  if (decision) return { kind: "decision", id: decision.id.slice(5) };
  for (const s of found) {
    const o = (await db.execute({ sql: "SELECT outcome_id FROM plan_items WHERE id=?", args: [s.id.slice(5)] })).rows[0]?.outcome_id;
    if (o) return { kind: "outcome", id: String(o) };
  }
  return null;
}

/** What a decision or piece of work connects to, as text for a chat or the terminal. */
export async function relatedText(db: Client, about: string, repo: string | null, embed: import("../embed/model.js").Embed): Promise<string> {
  const hit = await findItem(db, about, repo, embed);
  if (!hit) return `Found no decision or finished work about "${about}".`;
  const me = await describe(db, hit.kind, hit.id);
  const lines = [`${hit.kind === "decision" ? "Decision" : "Outcome"}: ${me.title}${me.date ? ` (${me.date.slice(0, 10)}${me.where ? `, ${me.where}` : ""})` : ""}`];
  if (hit.kind === "decision") { const why = (await db.execute({ sql: "SELECT why FROM plan_items WHERE id=?", args: [hit.id] })).rows[0]?.why; if (why) lines.push(`Because: ${why}`); }
  for (const g of await related(db, hit.kind, hit.id)) {
    if (g.rel === "part_of") { lines.push(`${g.label}: ${g.items.length} step(s)`); continue; }
    lines.push(`${g.label}:`, ...g.items.map((i) => `- ${i.title}${i.date ? ` (${i.date.slice(0, 10)})` : ""}`));
  }
  // Files: through the sessions this work (or the work this decision led to) was done in.
  const outcomes = hit.kind === "outcome" ? [hit.id] : (await db.execute({ sql: "SELECT dst_id FROM links WHERE src_id=? AND rel='motivates'", args: [hit.id] })).rows.map((r) => String(r.dst_id));
  if (outcomes.length) {
    const files = await filesFor(db, outcomes, 15);
    if (files.files.length) lines.push(files.fromGit ? "Files its commits changed:" : "Files its sessions worked on:", ...files.files.map((f) => `- ${f}`));
  }
  lines.push("", "These links come from muninn's notes. Check the code itself for what is affected today.");
  return lines.join("\n");
}

/** A long session covers many pieces of work, so its files say little about any one; past this many it's skipped. */
const FOCUSED_SESSION = 15;
/**
 * The files some work touched: the ones its commits changed (from git) when known, else those of its sessions,
 * counting only sessions short enough that their files belong to this work.
 */
export async function filesFor(db: Client, outcomes: string[], max: number): Promise<{ files: string[]; fromGit: boolean }> {
  const ins = outcomes.map(() => "?").join(",");
  const git = (await db.execute({ sql: `SELECT dst_id f, count(*) n FROM links WHERE rel='changes' AND src_id IN (${ins}) GROUP BY dst_id ORDER BY n DESC, dst_id LIMIT ?`, args: [...outcomes, max] })).rows.map((r) => String(r.f));
  if (git.length) return { files: git, fromGit: true };
  const rows = (await db.execute({ sql: `SELECT t.dst_id f, count(*) n FROM links b JOIN links t ON t.src_type='session' AND t.src_id=b.dst_id AND t.rel='touches' WHERE b.rel='built_in' AND b.src_id IN (${ins}) AND (SELECT count(*) FROM links x WHERE x.src_id=b.dst_id AND x.rel='touches') <= ? GROUP BY t.dst_id ORDER BY n DESC LIMIT ?`, args: [...outcomes, FOCUSED_SESSION, max] })).rows;
  return { files: rows.map((r) => String(r.f)), fromGit: false };
}
