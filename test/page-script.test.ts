import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";

/** The page is one file with one big script: a name declared twice stops all of it, leaving a blank page. */
describe("the muninn page's script", () => {
  it("parses, so the page can run at all", () => {
    const html = readFileSync(join(import.meta.dirname, "..", "src", "ui", "public", "index.html"), "utf8");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!.replace(/__REPO__|__TOKEN__/g, "null"));
    expect(scripts.length).toBeGreaterThan(0);
    for (const code of scripts) expect(() => new Script(code)).not.toThrow();
  });
});
