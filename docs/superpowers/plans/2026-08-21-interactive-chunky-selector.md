# Classic Sharpener Selector and Match Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the selector and match renderer one unmistakable classic single-hole sharpener identity while preserving the existing collider and all gameplay behavior.

**Architecture:** A focused client component owns selector inspection. A shared appearance contract owns canonical proportions and material profiles; a pure Three.js constructor builds the match body within the existing collider; R3F only assembles visual parts. CSS Modules provide the selector solid and nested transforms, preserving the no-selector-WebGL rule.

**Tech Stack:** React 19 Client Components, TypeScript, CSS Modules, Pointer Events, Playwright.

---

### Task 1: Extract the interactive preview

**Files:**
- Create: `apps/web/features/match/sharpener-preview.tsx`
- Modify: `apps/web/features/match/sharpener-selector.tsx`

- [x] Move preview anatomy behind a `SharpenerPreview` component accepting one `SharpenerCosmeticId`.
- [x] Add pointer capture and map horizontal drag to `rotateY` and vertical drag to `rotateX`.
- [x] Add arrow-key equivalents and pause/resume state for automatic rotation.
- [x] Keep cosmetic variables sourced from `getCosmetic()` and keep the preview free of `Canvas`.

### Task 2: Remodel the CSS solid

**Files:**
- Modify: `apps/web/features/match/sharpener-selector.module.css`

- [x] Increase model depth and reshape the shell into a compact school-sharpener wedge.
- [x] Add a right-end pencil opening, front grip ribs, rear riser, blade channel, blade, edge, screw, and detailed underside.
- [x] Change automatic motion to a slow `rotateX(360deg)` horizontal-axis animation.
- [x] Add grab/grabbing feedback, paused state, and reduced-motion rules.

### Task 3: Lock interaction behavior with browser tests

**Files:**
- Modify: `e2e/local-match.spec.ts`

- [x] Assert the selector still creates no canvas and exposes the thick geometry.
- [x] Drag diagonally and assert both manual CSS rotation variables change.
- [x] Assert automatic rotation pauses during manipulation and resumes after release.
- [x] Assert reduced motion disables automatic animation while leaving a dimensional transform.

### Task 4: Verify visuals and repository health

**Files:**
- Modify: `Architecture.md`
- Modify: `memory/memory.md`

- [x] Capture Chrome screenshots at top, edge, and underside phases.
- [x] Update ownership and durable product notes.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`, and `git diff --check`.
- [x] Preserve all pre-existing uncommitted classroom work and do not commit without separate authorization.

### Task 5: Lock shared classic-sharpener identity

**Files:**
- Create: `apps/web/features/match/sharpener-appearance.ts`
- Create: `apps/web/features/match/sharpener-geometry.ts`
- Create: `apps/web/features/match/sharpener-appearance.test.ts`
- Modify: `apps/web/features/match/sharpener-model.tsx`
- Modify: `apps/web/features/match/sharpener-preview.tsx`
- Modify: `apps/web/features/match/sharpener-selector.module.css`

- [x] Add failing tests for collider occupancy, compact body proportions, blade/body hierarchy, inlet prominence, and cosmetic-only material response.
- [x] Build an inlet-cut beveled match body that fills 98% of collider X and 97.2% of collider Z without changing physics.
- [x] Add the dark tunnel/bezel, short blade/channel, slotted screw, molded underside, and differentiated plastic/aluminium materials.
- [x] Replace the selector's utility-tool silhouette with a thicker body, prominent inlet, short blade, distinct screw, and low molded shoulder while retaining interaction behavior.

### Task 6: Validate the integrated redesign

**Files:**
- Modify: `e2e/local-match.spec.ts`
- Modify: `Architecture.md`
- Modify: `memory/memory.md`

- [x] Extend browser identity assertions for the inlet, blade channel/plate, screw, molded shoulder, and material finish.
- [x] Capture the selector and match at the same deterministic reduced-motion camera state and exercise a real collision path.
- [x] Run the complete unit, typecheck, lint, build, browser, and whitespace verification gates.

### Task 7: Close the selector shell at every rotation angle

**Files:**
- Modify: `apps/web/features/match/sharpener-preview.tsx`
- Modify: `apps/web/features/match/sharpener-selector.module.css`
- Modify: `e2e/local-match.spec.ts`
- Modify: `Architecture.md`
- Modify: `memory/memory.md`

- [x] **Step 1: Add a failing browser enclosure contract**

Assert that the selector exposes one enclosed body containing exactly six opaque core faces. Iterate every cosmetic choice and verify that no core face computes to a transparent fill while setting representative extreme X/Y pose variables.

- [x] **Step 2: Verify the new contract fails**

Run `npm run test:e2e -- --grep "enclosed selector shell"`. Expect failure because the current preview has no independent enclosed body.

- [x] **Step 3: Add the inset six-face body**

Render six core faces before all decorative layers. Use one `--selector-shell-inset: 0.06rem` value, centered transform origins, a shared `preserve-3d` parent, and an opaque two-sided cosmetic material. Keep top/bottom and four edge faces slightly behind the decorative skin so the core closes gaps without z-fighting.

- [x] **Step 4: Verify behavior and visuals**

Run the focused browser test. Capture Sunflower and Aluminium at default, edge-on, end-on, and underside poses. Confirm no open side, detached cap, transparent interior, dark z-fighting seam, or change to pointer/keyboard rotation.

- [x] **Step 5: Run repository gates**

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`, and `git diff --check`. Update architecture and compact memory with the durable enclosed-shell rule. Do not commit or push without separate authorization.
