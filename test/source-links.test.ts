import { describe, expect, it } from "vitest";
import { githubUrl, refsIn } from "../src/commands/source-links.js";

describe("source links", () => {
  it("turns a GitHub repo id into its page", () => {
    expect(githubUrl("github.com/rohitp/secondnature")).toBe("https://github.com/rohitp/secondnature");
    expect(githubUrl("github.com/rohitp/secondnature.git")).toBe("https://github.com/rohitp/secondnature");
    expect(githubUrl("/Users/me/scratch")).toBeNull();
    expect(githubUrl(null)).toBeNull();
  });
  it("finds commit hashes and pull requests, not words or plain numbers", () => {
    const r = refsIn("Merged PR #1 into main as 7e75f33; added a facade, 1234567 tests, see pull request 12");
    expect(r.shas).toEqual(["7e75f33"]);
    expect(r.prs).toEqual([1, 12]);
  });
});
