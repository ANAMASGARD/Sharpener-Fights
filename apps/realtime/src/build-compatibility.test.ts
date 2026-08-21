import { describe, expect, it } from "vitest";
import { assertCompatibleBuild } from "./build-compatibility";

describe("build compatibility", () => {
  it("rejects an old browser build before room admission", () => {
    expect(() => assertCompatibleBuild("web-old", "web-current")).toThrow("UPDATE_REQUIRED");
    expect(() => assertCompatibleBuild("web-current", "web-current")).not.toThrow();
  });
});
