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
 * Sets isEdited to true.
 */
export function editDraft(
  state: DraftState,
  changes: Partial<{ title: string; body: string }>,
): DraftState {
  return {
    ...state,
    current: {
      title: changes.title ?? state.current.title,
      body: changes.body ?? state.current.body,
    },
    isEdited: true,
  };
}

/**
 * Change the base branch — marks the draft as stale.
 * Does NOT destroy user edits.
 */
export function changeBase(state: DraftState, newBase: string): DraftState {
  return {
    ...state,
    base: newBase,
    isStale: true,
  };
}

/**
 * Regenerate the draft with new AI content.
 * Replaces both generated and current. Resets isEdited and isStale.
 */
export function regenerateDraft(
  state: DraftState,
  newGenerated: { title: string; body: string },
): DraftState {
  return {
    generated: newGenerated,
    current: { ...newGenerated },
    base: state.base,
    head: state.head,
    isEdited: false,
    isStale: false,
  };
}
