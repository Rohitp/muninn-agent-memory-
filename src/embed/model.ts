import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ensureHome } from "../config.js";

export const MODEL = "Xenova/bge-small-en-v1.5";
export const MODEL_SOURCE = `huggingface.co/${MODEL}`;
export const MODEL_SIZE = "about 33 MB";
export type Embed = (texts: string[]) => Promise<Map<string, Float32Array>>;
const dir = () => join(ensureHome(), "models");
export const modelCached = () => existsSync(dir()) && readdirSync(dir()).length > 0;

/** Shows one progress line while the model downloads, if output is a terminal. */
function progressBar() {
  const files = new Map<string, { loaded: number; total: number }>();
  let last = 0;
  return (p: any) => {
    if (!process.stderr.isTTY) return;
    if (p.status === "progress" && p.file && p.total) files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
    if (p.status === "ready") { if (files.size) process.stderr.write("\n"); return; }
    if (p.status !== "progress" || Date.now() - last < 100) return;
    last = Date.now();
    let loaded = 0, total = 0;
    for (const f of files.values()) { loaded += f.loaded; total += f.total; }
    const share = total ? loaded / total : 0;
    const bar = "#".repeat(Math.round(share * 30)).padEnd(30, ".");
    process.stderr.write(`\r  Downloading model [${bar}] ${(loaded / 1e6).toFixed(1)} / ${(total / 1e6).toFixed(1)} MB`);
  };
}

export async function loadEmbedder(): Promise<Embed> {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = dir();
  const model: any = await pipeline("feature-extraction", MODEL, { dtype: "q8", progress_callback: progressBar() });
  const cache = new Map<string, Float32Array>();
  return async (texts) => {
    for (const t of new Set(texts)) {
      if (cache.has(t)) continue;
      const r = await model(t, { pooling: "mean", normalize: true });
      cache.set(t, r.data as Float32Array);
    }
    return cache;
  };
}
export const cosine = (a: Float32Array, b: Float32Array) => { let d = 0; for (let i = 0; i < a.length; i++) d += a[i]! * b[i]!; return d; };
