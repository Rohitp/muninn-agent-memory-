import { spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureHome } from "../config.js";

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const openLink = (link: string) => {
  if (process.platform === "darwin") spawn("open", [link], { stdio: "ignore", detached: true }).unref();
  else if (process.platform === "linux") spawn("xdg-open", [link], { stdio: "ignore", detached: true }).unref();
};

/**
 * Starts `muninn ui` in the background, or reuses the one already running, and returns its link.
 * Used by `muninn setup` and by the Claude Code panel's "Open muninn" button.
 */
export async function uiDetached(opts: { open?: boolean; tab?: string } = {}): Promise<string> {
  const home = ensureHome();
  const state = join(home, "ui.json");
  if (existsSync(state)) {
    try {
      const s = JSON.parse(readFileSync(state, "utf8"));
      if (s.pid && alive(s.pid) && s.link) { const link = s.link + (opts.tab ? `#${opts.tab}` : ""); if (opts.open) openLink(link); return link; }
    } catch { /* start a fresh one */ }
  }
  const out = join(home, "ui.log");
  writeFileSync(out, "");
  const cli = join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
  const fd = openSync(out, "a");
  const child = spawn(process.execPath, [cli, "ui", "--no-open"], { detached: true, stdio: ["ignore", fd, fd] });
  child.unref();
  for (let i = 0; i < 50; i++) {
    const m = readFileSync(out, "utf8").match(/http:\/\/127\.0\.0\.1:\d+\/\?t=[\w-]+/);
    if (m) {
      writeFileSync(state, JSON.stringify({ pid: child.pid, link: m[0] }));
      const link = m[0] + (opts.tab ? `#${opts.tab}` : "");
      if (opts.open) openLink(link);
      return link;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`muninn ui didn't start. See ${out}.`);
}
