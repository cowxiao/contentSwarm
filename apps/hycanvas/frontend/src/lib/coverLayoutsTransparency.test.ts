import { describe, expect, it } from "vitest";

import { buildBeforeAfterCover, buildCoverLayout, coverLayouts } from "./coverElements";
import { buildXhsEditorialCover, xhsEditorialDefault } from "./xhsEditorialCover";

describe("system cover layout backgrounds", () => {
  it("keeps every standard cover layout transparent", () => {
    for (const layout of coverLayouts) {
      expect(buildCoverLayout(layout.id).pages[0].background).toBeUndefined();
    }
  });

  it("keeps the before-and-after cover transparent behind its editable content", () => {
    expect(buildBeforeAfterCover().pages[0].background).toBeUndefined();
  });

  it("keeps the editorial cover transparent", () => {
    const result = buildXhsEditorialCover(
      xhsEditorialDefault,
      (text, size) => text.length * size,
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.file.pages[0].background).toBeUndefined();
  });
});
