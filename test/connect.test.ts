import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { connectEverything, disconnectedFile, markDisconnected } from "../src/commands/connect.js";
import { claudeSettingsFile, installed } from "../src/commands/install.js";
import { useHome } from "./helpers.js";

beforeEach(() => { useHome(); process.env.MUNINN_LAUNCH_AGENTS_SKIP = "1"; });

describe("connecting every tool", () => {
  it("puts back a hook that dropped off, quietly, during automatic scans", async () => {
    await connectEverything({ quiet: true });
    expect(installed()).toContain("SessionStart");
    const cfg = JSON.parse(readFileSync(claudeSettingsFile(), "utf8")); delete cfg.hooks.SessionStart; writeFileSync(claudeSettingsFile(), JSON.stringify(cfg));
    expect(installed()).not.toContain("SessionStart");
    await connectEverything({ quiet: true });
    expect(installed()).toContain("SessionStart");
  });
  it("never puts muninn back after you took it out, until you connect it yourself", async () => {
    markDisconnected();
    expect(await connectEverything({ quiet: true })).toEqual([]);
    expect(existsSync(claudeSettingsFile()) ? installed() : []).toEqual([]);
    const steps = await connectEverything();
    expect(existsSync(disconnectedFile())).toBe(false);
    expect(steps.find((s) => s.what.startsWith("Hooks"))?.result).toBe("done");
  });
});
