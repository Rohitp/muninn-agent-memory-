import { describe, expect, it } from "vitest";
import { cleanRemote } from "../src/repo/identity.js";
describe("cleanRemote", () => {
  it("gives one identity for SSH and HTTPS", () => {
    expect(cleanRemote("git@github.com:Acme/App.git")).toBe("github.com/acme/app");
    expect(cleanRemote("https://user:pw@github.com/acme/app.git")).toBe("github.com/acme/app");
    expect(cleanRemote("ssh://git@github.com/acme/app")).toBe("github.com/acme/app");
  });
});
