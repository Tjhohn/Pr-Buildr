import type { DraftState } from "./types.js";

/**
 * Create a new draft state from AI-generated content.
 */
export function createDraft(
  generated: { title: string; body: string },
  base: string,
  head: string,
): DraftState {
  return {
    generated,
    current: { ...generated },
    base,
    head,
    isEdited: false,
    isStale: false,
  };
}

/**
 * Update the current draft with user edits.
 */
export function editDraft(
  state: DraftState,
  _changes: Partial<{ title: string; body: string }>,
): DraftState {
  // Stub — implementation in Phase 3
  return { ...state };
}

/**
 * Change the base branch — marks the draft as stale.
 */
export function changeBase(state: DraftState, newBase: string): DraftState {
  return { ...state, base: newBase, isStale: true };
}

/**
 * Regenerate the draft with new AI content.
 */
export function regenerateDraft(
  state: DraftState,
  _newGenerated: { title: string; body: string },
): DraftState {
  // Stub — implementation in Phase 3
  return { ...state };
}
