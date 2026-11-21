import { beforeEach, describe, expect, it } from "vitest";
import { openDb } from "../src/store/db.js";
import { createLesson, ensureRepo, getLesson } from "../src/store/lessons.js";
import { useHome } from "./helpers.js";

/** Starts the page's server and returns a POST helper with its token. */
async function server() {
  const { serve } = await import("../src/ui/server.js");
  const logs: string[] = []; const orig = console.log; console.log = (m: string) => logs.push(m);
  void serve(["--port", "0", "--no-open", "--no-watch"]);
  for (let i = 0; i < 50 && !logs.length; i++) await new Promise((r) => setTimeout(r, 20));
  console.log = orig;
  const link = logs[0]!.match(/http:\/\/\S+/)![0];
  const base = link.split("/?")[0]!; const token = link.split("t=")[1]!;
  return (path: string, body: unknown) => fetch(`${base}${path}`, { method: "POST", headers: { "x-muninn-token": token, "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("keeping a suggestion: where it applies and who hears it", () => {
  beforeEach(useHome);
  it("keeps a suggestion for another repo and one role, then widens it to every agent", async () => {
    const db = await openDb();
    await ensureRepo(db, "github.com/me/app", "/x"); await ensureRepo(db, "github.com/me/api", "/y");
    const id = await createLesson(db, { repo_id: "github.com/me/app", text: "Check inputs before approving.", source: "inferred", status: "proposed", by: "learn" });
    const post = await server();

    expect((await post("/api/decide", { id, action: "keep", route: "always", global: false, repo: "github.com/me/api", role: "reviewer" })).status).toBe(200);
    expect(await getLesson(db, id)).toMatchObject({ status: "live", repo_id: "github.com/me/api", role: "reviewer", scope: "repo" });

    expect((await post("/api/decide", { id, action: "save", route: "always", global: true, role: "" })).status).toBe(200);
    const after = await getLesson(db, id);
    expect(after).toMatchObject({ scope: "global" });
    expect(after!.role ?? null).toBeNull();
  });
});
