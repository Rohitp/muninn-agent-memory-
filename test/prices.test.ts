import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { home } from "../src/config.js";
import { costOf, priceOf } from "../src/workflow/prices.js";
import { dollars } from "../src/workflow/runs.js";
import { useHome } from "./helpers.js";

beforeEach(() => useHome());

describe("what a run cost", () => {
  it("uses list prices by model name, with cache reads cheaper than input", () => {
    expect(priceOf("claude-opus-5-5")).toEqual({ input: 4, output: 20, cacheRead: 0.2 });
    expect(priceOf("claude-sonnet-4-6")).toEqual({ input: 3, output: 15 });
    expect(costOf("claude-opus-5-5", { input: 1_000_000, output: 100_000, cacheRead: 2_000_000 })).toBeCloseTo(4 + 2 + 0.4);
    expect(costOf("gemini-4-neon-high", { input: 1, output: 1, cacheRead: 0 })).toBeNull();
  });
  it("takes your own prices for models muninn doesn't know", () => {
    mkdirSync(home(), { recursive: true });
    writeFileSync(join(home(), "config.json"), JSON.stringify({ prices: { "gemini-4-neon": { input: 1.25, output: 10 } } }));
    expect(costOf("gemini-4-neon-high", { input: 1_000_000, output: 0, cacheRead: 1_000_000 })).toBeCloseTo(1.25 + 0.125);
  });
  it("says when part of a role's cost is unknown", () => {
    expect(dollars([{ cost_usd: 1.5, tokens_in: 10, tokens_out: 1 }, { cost_usd: null, tokens_in: 10, tokens_out: 1 }])).toBe("about $1.50 plus some at an unknown price");
    expect(dollars([{ cost_usd: null, tokens_in: 10, tokens_out: 1 }])).toBe("price unknown");
  });
});
