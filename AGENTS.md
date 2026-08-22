<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sharpener Fights agent guide

This repository is a physics-first browser game: pool-style pull-back aiming drives asymmetric 3D sharpeners on an open school desk. Treat the live code as ground truth and keep documentation synchronized with behavior.

## Context router

- Read [`Architecture.md`](Architecture.md) before changing runtime behavior, package ownership, UI composition, physics, rendering, audio, tests, or dependencies. It is the authoritative current-state file and ownership map.
- Read [`memory/memory.md`](memory/memory.md) when continuing prior work, interpreting product intent, planning a phase, or deciding whether something is finished versus only planned.
- Read [`README.md`](README.md) for the human-facing quick start only. Do not use it as the detailed architecture source.
- If the user invokes `/graphify`, use the installed `graphify` skill before any other task action.

## Non-negotiable seams

- `packages/protocol` owns shared commands, snapshots, events, IDs, and runtime validation. Cross-process or future cross-network data starts here.
- `packages/game-core` is the sole physics and match-rules authority. It is headless TypeScript plus Rapier and must remain independent of React, Three.js, DOM APIs, and presentation.
- `apps/web/features/match/game.worker.ts` owns the local simulation instance and fixed-step clock. Rendering consumes snapshots; it does not run a second simulation.
- Three.js and React Three Fiber render state only. Keep `@react-three/rapier` out of this project so physics cannot split across two worlds.
- Physics advances at fixed 120 Hz. Never derive simulation behavior from display FPS.
- Mouse, touch, and pen share Pointer Events and one aiming calculation.
- Cosmetics are presentation-only. A color or skin must not alter mass, collider dimensions, impulse, friction, damping, or rules.
- Elimination occurs only below `PHYSICS.deathY`; crossing the desk edge starts a visible physical fall rather than deleting a body.
- A 15-second timeout passes the turn when no valid `ShotCommand` reached the authority. It does not auto-release an unfinished client drag.
- The browser game must retain the DOM classroom fallback. WebGL-disabled environments should show the desk, board, floor, and a useful status instead of a blank screen.

## Current product boundary

The implemented checkpoint includes local same-device play plus the code path for Clerk-authenticated human online play through private Friend invitations or compatible FIFO Instant matchmaking. Vercel route handlers call provider-independent `multiplayer-core`; Upstash Redis owns membership, checkpoints, revisions, locks, deadlines, invitations, matchmaking, leases, and idempotency; Liveblocks provides room-scoped connectivity, presence, notifications, and preset emotes only, with no Liveblocks Storage. The browser predicts legal releases and recovers authority by Redis revision. Online deployment remains unverified until provider secrets and two-browser/load gates are completed. Bots, persistence/progression, inventory, and free-text chat remain future work.

## Working method

1. Inspect the relevant module and its tests; use `rg` or `rg --files` for discovery.
2. Check `git status --short` before editing. Preserve unrelated and user-owned changes. Commits, pushes, rebases, deployments, and destructive cleanup require explicit authorization.
3. For Next.js work, follow the generated rule above and read the relevant installed guide under `node_modules/next/dist/docs/` before coding.
4. Change behavior at its owning seam. Avoid duplicating constants or rules in callers; update protocol types first when a message shape changes.
5. Add or update the narrowest meaningful test. Physics/rules belong in `packages/game-core/src/index.test.ts`; pure UI logic beside its module; browser journeys in `e2e/`.
6. Run verification proportional to the change and report each command as passed, failed, or not run.
7. Update `Architecture.md` when ownership, runtime flow, dependencies, public interfaces, or file responsibilities change. Update `memory/memory.md` when a milestone or durable product decision changes.

## Verification commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
git diff --check
```

`npm run test:e2e` starts a dedicated localhost server on port 3100 and requires an installed Google Chrome channel. `npm run test:pwa` uses the production server on port 3200. Run integration suites serially. The Rapier compatibility package currently prints a non-failing initialization deprecation warning in unit tests.
