import type { Client } from "@libsql/client";
import { randomUUID } from "node:crypto";

/**
 * How much muninn speaks without being asked, per repo:
 * quiet: never (agents can still run muninn ask); start: only when a session starts (rules and the handoff);
 * anytime: also mid-task, when a keyword or a failed command matches.
 */
export type Dial = "quiet" | "start" | "anytime";
export const DIALS: Dial[] = ["quiet", "start", "anytime"];
const key = (repo: string | null) => `dial:${repo ?? "*"}`;

export async function getDial(db: Client, repo: string | null): Promise<Dial> {
  for (const k of [key(repo), key(null)]) {
    const v = (await db.execute({ sql: "SELECT value FROM meta WHERE key=?", args: [k] })).rows[0]?.value;
    if (v && DIALS.includes(String(v) as Dial)) return String(v) as Dial;
  }
  return "anytime";
}
export async function setDial(db: Client, repo: string | null, dial: Dial) {
  if (!DIALS.includes(dial)) throw new Error(`The dial is one of ${DIALS.join(", ")}.`);
  await db.execute({ sql: "INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)", args: [key(repo), dial] });
}
export async function recordFeedback(db: Client, f: { lessonId?: string | null; handoffId?: string | null; session?: string | null; verdict: "helped" | "wrong" }) {
  await db.execute({ sql: "INSERT INTO feedback (id,ts,lesson_id,handoff_id,session,verdict) VALUES (?,?,?,?,?,?)", args: [randomUUID(), new Date().toISOString(), f.lessonId ?? null, f.handoffId ?? null, f.session ?? null, f.verdict] });
}
