# GLYPH-SCRIBE-25 — Presence Glyph

WAVE_ID: `2026-09-25-j-keel`
Repo: `DubjamMusic/beta_agent_editor`
Merge policy: **pr-only**

## Job
Bind the collaborative presence glyph as a scored card without rewriting the editor lock loop. This is not collab-scribe (Wave C circuit). New figure, new path, new wave id.

## Responsibilities
- Own `glyph.json` only.
- Print a reproducible density to three decimals.
- Keep merge policy pr-only.

## Knowledge required
- Density = (N^wN * V^wV * S^wS * D^wD)^(1 / totalWeight).
- Glyph scores presence; it does not touch AIChatBox or Manus dialogs.
- Chair holds merge.

## Primary path this wave
`figures/glyph-scribe/**` only.

## Out of scope
Do not rewrite `client/src/components/AIChatBox.tsx` this wave. Chat-tooling drift is a separate issue.
