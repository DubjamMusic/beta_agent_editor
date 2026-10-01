/**
 * Wave P latch — quill-latch
 * Repo: beta_agent_editor
 * Role: revision latch for collaborative document saves.
 * Knowledge required: a save may not close while a remote holder
 * still has unacked edits. Presence glyphs stay owned by earlier
 * figures (glyph-scribe, collab-scribe) and are out of scope.
 * Primary path: shared/figures/quill-latch.contract.ts
 */
export const WAVE_ID = "P-latch-20261001" as const;
export const FIGURE_ID = "quill-latch" as const;
export const ROLE = "revision-latch" as const;

export type LatchState = "open" | "held" | "released";

export interface RevisionLatch {
  waveId: typeof WAVE_ID;
  figureId: typeof FIGURE_ID;
  docId: string;
  holder: string;
  unackedEdits: number;
  state: LatchState;
}

export function hold(
  docId: string,
  holder: string,
  unackedEdits: number,
): RevisionLatch {
  if (!docId.trim() || !holder.trim()) {
    throw new Error("quill-latch requires docId and holder");
  }
  if (!Number.isInteger(unackedEdits) || unackedEdits < 0) {
    throw new Error("unackedEdits must be a non-negative integer");
  }
  return {
    waveId: WAVE_ID,
    figureId: FIGURE_ID,
    docId,
    holder,
    unackedEdits,
    state: unackedEdits === 0 ? "released" : "held",
  };
}

export function canClose(latch: RevisionLatch): boolean {
  return latch.figureId === FIGURE_ID && latch.state === "released" && latch.unackedEdits === 0;
}

/** Measurable self-check. Expected: pass=true, closed=false, openClose=true. */
export function selfCheck(): { pass: boolean; closed: boolean; openClose: boolean } {
  const held = hold("doc-wave-p", "quill-latch", 2);
  const released = hold("doc-wave-p", "quill-latch", 0);
  return {
    pass: held.state === "held" && held.unackedEdits === 2,
    closed: canClose(held),
    openClose: canClose(released),
  };
}
