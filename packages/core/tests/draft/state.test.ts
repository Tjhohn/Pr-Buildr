import { describe, it, expect } from "vitest";
import {
  createDraft,
  editDraft,
  changeBase,
  regenerateDraft,
} from "../../src/draft/state.js";

describe("createDraft", () => {
  it("initializes with generated content as current", () => {
    const state = createDraft({ title: "Title", body: "Body" }, "main", "feature/a");
    expect(state.generated).toEqual({ title: "Title", body: "Body" });
    expect(state.current).toEqual({ title: "Title", body: "Body" });
    expect(state.base).toBe("main");
    expect(state.head).toBe("feature/a");
    expect(state.isEdited).toBe(false);
    expect(state.isStale).toBe(false);
  });

  it("current is a copy, not the same reference as generated", () => {
    const state = createDraft({ title: "Title", body: "Body" }, "main", "feature/a");
    expect(state.current).not.toBe(state.generated);
  });
});

describe("editDraft", () => {
  it("updates title and marks as edited", () => {
    const state = createDraft({ title: "Old", body: "Body" }, "main", "feature/a");
    const edited = editDraft(state, { title: "New" });

    expect(edited.current.title).toBe("New");
    expect(edited.current.body).toBe("Body"); // unchanged
    expect(edited.isEdited).toBe(true);
  });

  it("updates body and marks as edited", () => {
    const state = createDraft({ title: "Title", body: "Old" }, "main", "feature/a");
    const edited = editDraft(state, { body: "New body" });

    expect(edited.current.title).toBe("Title"); // unchanged
    expect(edited.current.body).toBe("New body");
    expect(edited.isEdited).toBe(true);
  });

  it("updates both title and body", () => {
    const state = createDraft({ title: "Old", body: "Old" }, "main", "feature/a");
    const edited = editDraft(state, { title: "New title", body: "New body" });

    expect(edited.current).toEqual({ title: "New title", body: "New body" });
    expect(edited.isEdited).toBe(true);
  });

  it("preserves generated content", () => {
    const state = createDraft({ title: "Original", body: "Original" }, "main", "feature/a");
    const edited = editDraft(state, { title: "Changed" });

    expect(edited.generated).toEqual({ title: "Original", body: "Original" });
  });

  it("does not mutate original state", () => {
    const state = createDraft({ title: "Old", body: "Old" }, "main", "feature/a");
    editDraft(state, { title: "New" });

    expect(state.current.title).toBe("Old");
    expect(state.isEdited).toBe(false);
  });
});

describe("changeBase", () => {
  it("updates base and marks as stale", () => {
    const state = createDraft({ title: "Title", body: "Body" }, "main", "feature/a");
    const changed = changeBase(state, "develop");

    expect(changed.base).toBe("develop");
    expect(changed.isStale).toBe(true);
  });

  it("preserves current edits", () => {
    const state = createDraft({ title: "Title", body: "Body" }, "main", "feature/a");
    const edited = editDraft(state, { title: "Edited title" });
    const changed = changeBase(edited, "develop");

    expect(changed.current.title).toBe("Edited title");
    expect(changed.isEdited).toBe(true);
    expect(changed.isStale).toBe(true);
  });
});

describe("regenerateDraft", () => {
  it("replaces both generated and current", () => {
    const state = createDraft({ title: "Old", body: "Old" }, "main", "feature/a");
    const regenerated = regenerateDraft(state, { title: "New", body: "New" });

    expect(regenerated.generated).toEqual({ title: "New", body: "New" });
    expect(regenerated.current).toEqual({ title: "New", body: "New" });
  });

  it("resets isEdited and isStale", () => {
    let state = createDraft({ title: "Old", body: "Old" }, "main", "feature/a");
    state = editDraft(state, { title: "Edited" });
    state = changeBase(state, "develop");

    expect(state.isEdited).toBe(true);
    expect(state.isStale).toBe(true);

    const regenerated = regenerateDraft(state, { title: "Fresh", body: "Fresh" });
    expect(regenerated.isEdited).toBe(false);
    expect(regenerated.isStale).toBe(false);
  });

  it("preserves base and head from state", () => {
    let state = createDraft({ title: "Old", body: "Old" }, "main", "feature/a");
    state = changeBase(state, "develop");
    const regenerated = regenerateDraft(state, { title: "New", body: "New" });

    expect(regenerated.base).toBe("develop");
    expect(regenerated.head).toBe("feature/a");
  });
});
