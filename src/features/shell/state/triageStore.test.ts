import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_TRIAGE_SELECTION, triageScopeLabel, useTriageStore } from "./triageStore";

describe("triageStore", () => {
  beforeEach(() => {
    useTriageStore.getState().reset();
  });

  it("defaults to the recent shortcut", () => {
    expect(useTriageStore.getState().selection).toEqual(DEFAULT_TRIAGE_SELECTION);
  });

  it("updates selection via setSelection", () => {
    useTriageStore.getState().setSelection({ kind: "tag", tag: "meetings" });
    expect(useTriageStore.getState().selection).toEqual({ kind: "tag", tag: "meetings" });
  });

  it("computes a human label per selection kind", () => {
    expect(triageScopeLabel({ kind: "shortcut", id: "pinned" })).toBe("Pinned");
    expect(triageScopeLabel({ kind: "shortcut", id: "inbox" })).toBe("Inbox");
    expect(triageScopeLabel({ kind: "shortcut", id: "recent" })).toBe("Recent");
    expect(triageScopeLabel({ kind: "folder", path: "Projects/Noxe" })).toBe("Projects/Noxe");
    expect(triageScopeLabel({ kind: "folder", path: "" })).toBe("Vault");
    expect(triageScopeLabel({ kind: "tag", tag: "meetings" })).toBe("#meetings");
  });
});
