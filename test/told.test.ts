import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { toldData } from "../src/commands/told.js";
import { openDb } from "../src/store/db.js";
import { useHome } from "./helpers.js";

const repo = "github.com/me/app";
const now = new Date().toISOString();
beforeEach(() => { useHome(); });

async function setup() {
  const db = await openDb();
  for (const r of [repo, "github.com/me/other"]) await db.execute({ sql: "INSERT OR IGNORE INTO repos (id,paths) VALUES (?,'[]')", args: [r] });
  const lesson = async (id: string, o: { scope?: string; repo?: string | null; always?: number; role?: string | null; kw?: string } = {}) => {
    await db.execute({ sql: "INSERT INTO lessons (id,repo_id,scope,text,source,status,always_on,role,created_at,updated_at) VALUES (?,?,?,?,'manual','live',?,?,?,?)", args: [id, o.repo === undefined ? repo : o.repo, o.scope ?? "repo", `lesson ${id}`, o.always ?? 0, o.role ?? null, now, now] });
    if (o.kw) await db.execute({ sql: "INSERT INTO triggers (id,lesson_id,pattern,created_at) VALUES (?,?,?,?)", args: [randomUUID(), id, o.kw, now] });
  };
  const told = (session: string, event: string, outcome: string, x: { lesson?: string; handoff?: string; trigger?: string; tool?: string } = {}) =>
    db.execute({ sql: "INSERT INTO deliveries (id,ts,tool,session,event,lesson_id,outcome,tokens,trigger_id,handoff_id) VALUES (?,?,?,?,?,?,?,0,?,?)", args: [randomUUID(), now, x.tool ?? "claude-code", session, event, x.lesson ?? null, outcome, x.trigger ?? null, x.handoff ?? null] });
  return { db, lesson, told };
}

describe("what secondnature told agents", () => {
  it("groups each session's deliveries, says why each lesson went, and which were held back", async () => {
    const { db, lesson, told } = await setup();
    await lesson("A", { always: 1 }); await lesson("B", { kw: "deploy" }); await lesson("C", { always: 1 });
    await db.execute({ sql: "INSERT INTO handoffs (id,repo_id,branch,session,tool,text,created_at) VALUES ('H',?,'main','old','claude-code','left off here',?)", args: [repo, now] });
    await told("s1", "SessionStart", "sent", { lesson: "A" });
    await told("s1", "SessionStart", "limit", { lesson: "C" });
    await told("s1", "SessionStart", "sent", { handoff: "H" });
    await told("s1", "UserPromptSubmit", "sent", { lesson: "B", trigger: "deploy" });
    await told("s1", "UserPromptSubmit", "no_match");
    const d = await toldData(db, repo, 7);
    expect(d.sessions).toHaveLength(1);
    const s = d.sessions[0]!;
    expect(s.told.map((t) => [t.id, t.why])).toEqual([["A", "every session gets it"], ["H", "where the last session on this branch left off"], ["B", 'matched "deploy"']]);
    expect(s.held.map((t) => t.id)).toEqual(["C"]);
    expect(d.outcomes).toEqual({ sent: 3, limit: 1, no_match: 1 });
  });
  it("places a session by its stored log, never by the repo a lesson kept everywhere came from", async () => {
    const { db, lesson, told } = await setup();
    await lesson("G", { scope: "global", repo: "github.com/me/other", always: 1 });
    await told("s2", "SessionStart", "sent", { lesson: "G" });
    await told("s3", "SessionStart", "sent", { lesson: "G" });
    await db.execute({ sql: "INSERT INTO chunks (id,repo_id,session,tool,ts,seq,text) VALUES ('c1',?,'s2','claude-code',?,0,'x')", args: [repo, now] });
    const d = await toldData(db, repo, 7);
    expect(d.sessions.map((x) => x.session)).toEqual(["s2"]);
    expect(d.unplaced).toBe(1);
    expect((await toldData(db, "github.com/me/other", 7)).sessions).toEqual([]);
  });
  it("lists kept lessons no agent was told, with how each would reach one", async () => {
    const { lesson, told, db } = await setup();
    await lesson("A", { always: 1 }); await lesson("K", { kw: "flaky" }); await lesson("L"); await lesson("R", { always: 1, role: "qa" });
    await told("s1", "SessionStart", "sent", { lesson: "A" });
    const d = await toldData(db, repo, 7);
    expect(d.neverTold.map((l) => [l.id, l.how, l.role]).sort()).toEqual([["K", "keyword", null], ["L", "lookup", null], ["R", "always", "qa"]]);
  });
});
