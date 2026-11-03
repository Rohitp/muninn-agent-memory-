// Copies non-TypeScript files into dist/, for those that exist yet.
import { cpSync, existsSync } from "node:fs";

for (const [from, to] of [
  ["src/store/migrations", "dist/store/migrations"],
  ["src/ui/public", "dist/ui/public"],
]) {
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}
