import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { countLogs } from "../src/commands/auto.js";
import { plistPath, schedule } from "../src/commands/schedule.js";
import { tmp, useHome, write } from "./helpers.js";

beforeEach(() => { useHome(); process.env.MUNINN_LAUNCH_AGENTS = join(tmp(), "LaunchAgents"); });
afterEach(() => { delete process.env.MUNINN_LAUNCH_AGENTS; delete process.env.MUNINN_LOG_ROOT; });

describe("scans without Claude Code", () => {
  it("count Antigravity logs toward a scan being due", () => {
    const logs = tmp(); process.env.MUNINN_LOG_ROOT = logs;
    const before = countLogs();
    write(join(logs, "antigravity", "antigravity", "brain", "c1", ".system_generated", "logs", "transcript.jsonl"), [{ type: "USER_INPUT" }]);
    expect(countLogs()).toBe(before + 1);
  });
  it.runIf(process.platform === "darwin")("installs and removes a background job that runs the same due-only scan", () => {
    schedule("on");
    const p = readFileSync(plistPath(), "utf8");
    expect(p).toContain("<string>learn</string><string>--auto</string><string>--all-repos</string>");
    expect(p).toContain("<integer>10800</integer>");
    expect(p).toMatch(/<key>PATH<\/key><string>[^<]*\/usr\/bin/);
    schedule("off");
    expect(existsSync(plistPath())).toBe(false);
  });
});
