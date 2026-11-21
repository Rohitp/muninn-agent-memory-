import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Embed } from "../src/embed/model.js";
import type { Session } from "../src/logs/types.js";

export const tmp = () => mkdtempSync(join(tmpdir(), "muninn-test-"));
/** A fresh muninn home, with every client config file pointed inside it so tests never touch real ones. */
export function useHome() {
  const h = tmp(); process.env.MUNINN_HOME = h;
  process.env.MUNINN_CLAUDE_SETTINGS = join(h, "claude-settings.json");
  process.env.MUNINN_CLAUDE_JSON = join(h, "claude.json");
  process.env.MUNINN_DESKTOP_CONFIG = join(h, "claude-desktop", "claude_desktop_config.json");
  process.env.MUNINN_CODEX_HOOKS = join(h, "codex-hooks.json");
  // Antigravity's MCP settings: a folder that doesn't exist, so tests never write the real one.
  process.env.MUNINN_ANTIGRAVITY_MCP = join(h, "antigravity", "mcp_config.json");
  process.env.MUNINN_CURSOR_MCP = join(h, "cursor", "mcp.json");
  process.env.MUNINN_CODEX_CONFIG = join(h, "codex", "config.toml");
  process.env.MUNINN_ANTIGRAVITY_HOOKS = join(h, "antigravity", "hooks.json");
  return h;
}

/** Bag-of-words vectors: same words give similarity 1. No model needed. */
export const fakeEmbed: Embed = async (texts) => {
  const out = new Map<string, Float32Array>();
  for (const t of texts) {
    const v = new Float32Array(384);
    for (const w of t.toLowerCase().split(/\W+/).filter(Boolean)) { let h = 0; for (const c of w) h = (h * 31 + c.charCodeAt(0)) % 384; v[h] = (v[h] ?? 0) + 1; }
    const n = Math.hypot(...v) || 1;
    out.set(t, v.map((x) => x / n));
  }
  return out;
};
const day = (d: number) => `2026-10-${String(d).padStart(2, "0")}T10:00:00.000Z`;
export function session(id: string, d: number, typed: string[], tool: Session["tool"] = "claude-code"): Session {
  return { id, tool, cwd: "/x", clientVersion: "1", unknown: 0, events: typed.map((text) => ({ k: "typed" as const, text, ts: day(d) })) };
}
export { day };
export function write(file: string, lines: unknown[]) { mkdirSync(join(file, ".."), { recursive: true }); writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n"); }
