import { describe, expect, it } from "vitest";
import { needsHandoff } from "../src/handoff/handoff.js";
import type { Session } from "../src/logs/types.js";

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 10, 21, h, m)).toISOString();
const session = (id: string, last: string): Session => ({ id, tool: "antigravity", cwd: "/r", clientVersion: "1", unknown: 0, branch: "main", events: [{ k: "typed", text: "go", ts: at(14) }, { k: "agent", text: "ok", ts: last }] });

describe("a handoff written while its session was still running", () => {
  const now = Date.parse(at(20));
  it("is written again once the session carried on well past it", () => {
    const s = session("s1", at(15, 53));
    expect(needsHandoff([s], new Map([["s1", at(14, 34)]]), 2, now).map((x) => x.id)).toEqual(["s1"]);
  });
  it("is left alone when the session stopped soon after", () => {
    const s = session("s1", at(14, 50));
    expect(needsHandoff([s], new Map([["s1", at(14, 34)]]), 2, now)).toEqual([]);
  });
  it("a session with no handoff still gets one", () => {
    expect(needsHandoff([session("s2", at(15))], new Map(), 2, now).map((x) => x.id)).toEqual(["s2"]);
  });
});
