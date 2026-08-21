# Classic Sharpener Selector and Match Model Design

## Goal

Replace the blade-dominant selector and generic match slab with one recognizable classic single-hole school-sharpener identity. The selector must rotate automatically around a horizontal axis while allowing direct pointer and keyboard rotation around both axes. The match model must preserve every existing physics property and closely fill the unchanged collider.

## Design

- Keep the preview DOM/CSS based. A second R3F canvas would violate the established one-WebGL-context resilience boundary.
- Make the colored body short, chunky, and visually dominant. Make the circular pencil inlet the strongest identity cue; keep the mounted blade short and secondary; retain one distinct slotted screw and a low integrated molded shoulder.
- Drive cosmetic body, edge, and highlight colors from the existing `getCosmetic()` source of truth. Shape and interaction remain cosmetic-only.
- Share canonical body/inlet/blade/screw proportions and material profiles between selector and match presentations. Five colors read as satin plastic; Aluminium changes material response but not geometry or physics.
- Run a slow continuous `rotateX()` animation on an inner turntable. Pointer dragging controls an outer manual `rotateX()` and `rotateY()` pose through Pointer Events and pointer capture.
- Pause the automatic animation while the user manipulates the preview. Resume it after a short release delay without resetting the manually chosen pose.
- Support arrow-key rotation for keyboard users. Respect `prefers-reduced-motion` by disabling automatic movement while retaining manual interaction and a readable three-quarter pose.

## Boundaries

- Create `apps/web/features/match/sharpener-preview.tsx` for interaction state and preview anatomy.
- Create `sharpener-appearance.ts` for shared visual invariants and `sharpener-geometry.ts` for pure Three.js body construction.
- Keep visual geometry and materials in `sharpener-selector.module.css` to remain consistent with the selector case.
- Keep `sharpener-selector.tsx` responsible only for selection, persistence, audio, and lock-in flow.
- Assemble the match render parts in `sharpener-model.tsx`; do not move visual rules into the worker or game core.
- Do not alter match physics, the in-game collider, protocol, camera, aiming, networking, or game rules. The visible match body must occupy at least 90% of the collider's X and Z footprint and remain fully inside it.

## Verification

- E2E verifies that no selector canvas exists, the preview has thick modeled faces, horizontal automatic rotation is configured, pointer dragging changes both manual axes, automatic motion resumes, and reduced motion disables automatic animation.
- Unit tests measure the generated match body's collider occupancy, compact body ratios, blade/body hierarchy, inlet prominence, and cosmetic-only material response.
- Capture and inspect a deterministic selector pose and the match view in Chrome; exercise a real shot/contact path without changing simulation behavior.

## Enclosed-shell correction

The decorative selector planes must never be responsible for making the object solid. Add one inset six-face CSS cuboid beneath the existing surface details. Its front, back, top, bottom, left, and right faces share one parent coordinate system, one depth variable, centered transform origins, and a consistent opaque two-sided material. Keep the core slightly behind the decorative skin with a `0.06rem` inset: large enough to cover sub-pixel cracks, small enough to avoid coplanar z-fighting or visible dark seams.

The pencil inlet, blade recess, blade, screw, molded shoulder, ribs, branding, and underside details remain presentation layers outside the core. The sixteen-second horizontal turn, pointer capture, keyboard inspection, pause/resume behavior, cosmetic selection, reduced motion, match renderer, and physics stay unchanged. Browser verification must exercise all six cosmetics plus top, underside, end-on, and near-edge-on rotations; light Aluminium and Sunflower are the primary crack-detection finishes.
- Run unit tests, typecheck, lint, production build, E2E, and `git diff --check`.
