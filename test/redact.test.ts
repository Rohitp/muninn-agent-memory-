import { describe, expect, it } from "vitest";
import { redact } from "../src/privacy/redact.js";
describe("redact", () => {
  it.each(["sk-abcdefghijklmnop1234", "ghp_abcdefghijklmnop1234", "AKIAABCDEFGHIJKLMNOP", "xoxb-1234567890-abc", "AIzaSyA1234567890abcdefghij", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc", "password=hunter2hunter2", "token: abcd1234efgh", "me@example.com"])("removes %s", (s) => {
    expect(redact(`before ${s} after`)).toContain("[REDACTED]");
    expect(redact(`before ${s} after`)).not.toContain(s);
  });
  it("leaves commit hashes and normal words alone", () => { expect(redact("revert a1b2c3d4 please refresh the token first")).toBe("revert a1b2c3d4 please refresh the token first"); });
});
