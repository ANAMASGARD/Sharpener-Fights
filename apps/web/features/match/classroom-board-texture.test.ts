import { describe, expect, it } from "vitest";
import { formatBoardDate } from "./classroom-board-texture";

describe("formatBoardDate", () => {
  it("formats an injected local date as zero-padded DD/MM/YYYY", () => {
    expect(formatBoardDate(new Date(2026, 7, 21))).toBe("21/08/2026");
    expect(formatBoardDate(new Date(2026, 0, 3))).toBe("03/01/2026");
  });
});
