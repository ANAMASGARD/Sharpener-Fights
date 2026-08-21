import { describe, expect, it } from "vitest";
import { acceptsAuthoritativeFrame } from "./frame-sequence";

describe("authoritative frame ordering", () => {
  it("accepts only monotonically newer frames", () => {
    expect(acceptsAuthoritativeFrame(-1, 0)).toBe(true);
    expect(acceptsAuthoritativeFrame(7, 8)).toBe(true);
    expect(acceptsAuthoritativeFrame(7, 7)).toBe(false);
    expect(acceptsAuthoritativeFrame(7, 6)).toBe(false);
  });
});
