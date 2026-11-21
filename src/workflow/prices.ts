import { settings } from "../config.js";

/**
 * List prices per million tokens, to estimate what a run cost from the tokens its logs record. Logs don't record
 * cost, so this is an estimate at list price: no discounts, and cache writes counted as plain input.
 * Anthropic first-party prices as of 2026-11-03. Your own entries in muninn's config.json ("prices") come first,
 * and are the only way to price models muninn doesn't know, such as Gemini.
 */
export const PRICES_AS_OF = "2026-11-03";
type Price = { input: number; output: number; cacheRead?: number };
const KNOWN: [string, Price][] = [
  ["claude-fable-5-2", { input: 8, output: 40, cacheRead: 0.2 }], ["claude-mythos-5-2", { input: 8, output: 40, cacheRead: 0.2 }],
  ["claude-fable-5", { input: 10, output: 50 }], ["claude-mythos-5", { input: 10, output: 50 }],
  ["claude-opus-5-5", { input: 4, output: 20, cacheRead: 0.2 }], ["claude-opus-5", { input: 5, output: 25 }], ["claude-opus-4", { input: 5, output: 25 }],
  ["claude-sonnet-5-5", { input: 2, output: 10, cacheRead: 0.1 }], ["claude-sonnet-5", { input: 2, output: 10 }], ["claude-sonnet-4", { input: 3, output: 15 }],
  ["claude-haiku-5-5", { input: 0.1, output: 0.5 }], ["claude-haiku-4", { input: 1, output: 5 }],
];
/** The price for a model, by longest matching name prefix; your own prices first. Null when muninn doesn't know it. */
export function priceOf(model: string | null | undefined): Price | null {
  if (!model) return null;
  const m = model.toLowerCase();
  const mine = Object.entries(settings().prices ?? {}).filter(([k]) => m.startsWith(k.toLowerCase())).sort((a, b) => b[0].length - a[0].length)[0];
  if (mine) return mine[1];
  return KNOWN.filter(([k]) => m.startsWith(k)).sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? null;
}
/** Estimated dollars for some tokens on a model, or null if its price isn't known. Cache reads at a tenth of input unless priced. */
export function costOf(model: string | null | undefined, t: { input: number; output: number; cacheRead: number }): number | null {
  const p = priceOf(model);
  if (!p) return null;
  return (t.input * p.input + t.output * p.output + t.cacheRead * (p.cacheRead ?? p.input / 10)) / 1e6;
}
