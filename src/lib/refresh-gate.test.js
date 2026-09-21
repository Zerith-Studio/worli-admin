import { describe, expect, it } from "vitest";
import { shouldBackgroundRefresh, readRefreshContext } from "./refresh-gate";

const idle = { visible: true, hasTextSelection: false, isEditing: false };

describe("shouldBackgroundRefresh", () => {
  it("refreshes an idle, visible page", () => {
    expect(shouldBackgroundRefresh(idle)).toBe(true);
  });

  it("never refreshes a hidden tab", () => {
    expect(shouldBackgroundRefresh({ ...idle, visible: false })).toBe(false);
  });

  it("holds off while text is selected", () => {
    // The reported symptom: rows rewrite under the cursor while the selection
    // is being dragged out for a paste into Sheets.
    expect(shouldBackgroundRefresh({ ...idle, hasTextSelection: true })).toBe(false);
  });

  it("holds off while a form field has focus", () => {
    expect(shouldBackgroundRefresh({ ...idle, isEditing: true })).toBe(false);
  });
});

describe("readRefreshContext", () => {
  const doc = (activeElement, visibilityState = "visible") => ({
    visibilityState,
    activeElement,
  });
  const sel = (text, collapsed = false) => ({
    isCollapsed: collapsed,
    toString: () => text,
  });

  it("reads a dragged-out selection as a selection", () => {
    expect(readRefreshContext(doc(null), () => sel("Arun Java\t9820...")))
      .toMatchObject({ hasTextSelection: true });
  });

  it("ignores a collapsed caret and a whitespace-only selection", () => {
    expect(readRefreshContext(doc(null), () => sel("text", true)))
      .toMatchObject({ hasTextSelection: false });
    expect(readRefreshContext(doc(null), () => sel("   \n ")))
      .toMatchObject({ hasTextSelection: false });
  });

  it("treats inputs, textareas, selects and contenteditable as editing", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      expect(readRefreshContext(doc({ tagName }), () => null))
        .toMatchObject({ isEditing: true });
    }
    expect(readRefreshContext(doc({ tagName: "DIV", isContentEditable: true }), () => null))
      .toMatchObject({ isEditing: true });
    expect(readRefreshContext(doc({ tagName: "DIV" }), () => null))
      .toMatchObject({ isEditing: false });
  });

  it("survives an environment with no selection API", () => {
    expect(readRefreshContext(doc(null), undefined))
      .toEqual({ visible: true, hasTextSelection: false, isEditing: false });
  });
});
