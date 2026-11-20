// Publishes a new version of secondnature in one step: checks, tests, build, npm, git tag, GitHub release.
//
//   pnpm release patch        0.1.0 → 0.1.1 (fixes)
//   pnpm release minor        0.1.0 → 0.2.0 (new features)
//   pnpm release 0.3.0        an exact version
//   pnpm release patch --dry-run   everything up to publishing, then stops and changes nothing
//
// Run it in a terminal: npm asks for your authenticator code (or opens the browser) when it publishes.
// Nothing is committed, tagged or pushed until npm has accepted the package. If publishing fails,
// package.json goes back to the old version and the repo is left as it was.
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const bump = args.find((a) => !a.startsWith("--"));

const out = (cmd, a) => execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
/** Runs a step with its output shown; stops the release if it fails. */
function step(title, cmd, a) {
  console.log(`\n▸ ${title}`);
  const r = spawnSync(cmd, a, { stdio: "inherit" });
  if (r.status !== 0) stop(`${title} failed, so nothing was released.`);
}
function stop(why) { console.error(`\n✗ ${why}`); process.exit(1); }

function nextVersion(current, how) {
  if (/^\d+\.\d+\.\d+$/.test(how)) return how;
  const [maj, min, pat] = current.split("-")[0].split(".").map(Number);
  if (how === "patch") return `${maj}.${min}.${pat + 1}`;
  if (how === "minor") return `${maj}.${min + 1}.0`;
  if (how === "major") return `${maj + 1}.0.0`;
  return null;
}

if (!bump) stop('Say which kind of release: "pnpm release patch" (fixes), "minor" (new features), "major", or an exact version like 0.3.0.');
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = nextVersion(pkg.version, bump);
if (!version) stop(`"${bump}" isn't patch, minor, major or a version like 0.3.0.`);
const tag = `v${version}`;

// 1. The repo is ready: on main, nothing uncommitted, nothing GitHub has that this copy doesn't.
console.log(`Releasing ${pkg.name} ${pkg.version} → ${version}${dry ? " (dry run: nothing will be published or changed)" : ""}`);
if (out("git", ["rev-parse", "--abbrev-ref", "HEAD"]) !== "main") stop("Switch to the main branch first.");
if (out("git", ["status", "--porcelain"]) && !dry) stop("There are uncommitted changes. Commit or put them aside first, so the release is exactly what's in git.");
step("Checking GitHub for newer commits", "git", ["fetch", "--quiet", "origin", "main", "--tags"]);
if (out("git", ["rev-list", "--count", "HEAD..origin/main"]) !== "0") stop("GitHub has commits this copy doesn't. Pull them first (git pull).");
if (out("git", ["tag", "--list", tag])) stop(`${tag} already exists. Pick a higher version.`);
try { out("npm", ["whoami"]); } catch { stop('You\'re not logged in to npm on this machine. Run "npm login" first.'); }
try { out("gh", ["auth", "status"]); } catch { stop('The GitHub command line tool isn\'t logged in. Run "gh auth login" first.'); }

// 2. It works: types, tests, a fresh build.
step("Checking types", "pnpm", ["typecheck"]);
step("Running the tests", "pnpm", ["test"]);
step("Building", "pnpm", ["build"]);

// What changed since the last release, for the GitHub release notes.
let last = "";
try { last = out("git", ["describe", "--tags", "--abbrev=0"]); } catch { /* the first release */ }
const subjects = out("git", ["log", "--format=%s", ...(last ? [`${last}..HEAD`] : [])]).split("\n").filter(Boolean);
const notes = `## What changed${last ? ` since ${last}` : ""}\n\n${subjects.map((s) => `- ${s}`).join("\n") || "- Small fixes"}\n\n## Install or update\n\n\`\`\`sh\nnpm install -g ${pkg.name}@${version}\n\`\`\`\n`;
console.log(`\n▸ Release notes\n${notes}`);

// 3. Publish with the new version. The version is written to package.json only for this, and put back if it fails.
const original = readFileSync("package.json", "utf8");
writeFileSync("package.json", original.replace(`"version": "${pkg.version}"`, `"version": "${version}"`));
const restore = () => writeFileSync("package.json", original);
console.log(`\n▸ ${dry ? "Checking what would be published" : "Publishing to npm. npm may ask for your authenticator code, or open your browser"}`);
const pub = spawnSync("npm", ["publish", "--access", "public", ...(dry ? ["--dry-run"] : [])], { stdio: "inherit" });
if (dry) { restore(); console.log(`\n✓ Dry run done. "pnpm release ${bump}" would publish ${pkg.name} ${version}, then commit, tag and push ${tag} and create its GitHub release.`); process.exit(0); }
if (pub.status !== 0) { restore(); stop("npm didn't publish it (a wrong or expired code is the usual reason). package.json is back to the old version; run the same command again."); }

// 4. Record it: commit the version, tag it, push both, and create the GitHub release.
step("Committing the new version", "git", ["commit", "--quiet", "-am", `Release ${version}`]);
step(`Tagging ${tag}`, "git", ["tag", "-a", tag, "-m", `${pkg.name} ${version}`]);
step("Pushing to GitHub", "git", ["push", "--quiet", "origin", "main", tag]);
step("Creating the GitHub release", "gh", ["release", "create", tag, "--title", `${pkg.name} ${version}`, "--notes", notes]);
console.log(`\n✓ ${pkg.name} ${version} is on npm and GitHub. If npm held it for approval, approve it under Staged Packages on npmjs.com.`);
