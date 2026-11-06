import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ensureHome } from "../config.js";

export const MODEL = "Xenova/bge-small-en-v1.5";
export type Embed = (texts: string[]) => Promise<Map<string, Float32Array>>;
const dir = () => join(ensureHome(), "models");
export const modelCached = () => existsSync(dir()) && readdirSync(dir()).length > 0;

export async function loadEmbedder(): Promise<Embed> {
  const { pipeline, env } = await import("@huggingface/transformers");
  env.cacheDir = dir();
  const model: any = await pipeline("feature-extraction", MODEL, { dtype: "q8" });
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
