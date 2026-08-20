# Sharpener Fights compact project memory

> Handoff snapshot from the initial design and implementation session, updated 2026-08-21. Read this for intent, decisions, completed work, and unfinished work. Read [`../Architecture.md`](../Architecture.md) for current file ownership and runtime details. Verify mutable facts against the live repository before acting.

## Product north star

Build a browser game with the aiming language of 8 Ball Pool and the physical character of real sharpeners:

> Aim, pull backward, read power, release, collide, wait for rest—then win by physically knocking the other sharpener off an open school desk.

The differentiator is 3D asymmetric rigid-body behavior: sharpeners translate, rotate, spin, tip, hang over an edge, fall under gravity, and create torque from off-center hits. It should feel like a nostalgic school-desk fight, not a pool-table reskin or a generic HTML mini-game.

## Durable decisions

- Stack: Next.js + TypeScript, React Three Fiber/Three.js for rendering, Rapier Wasm for physics, Pointer Events for all pointer types, Web Audio for synthesized cues, and HTML media for supplied MP3 assets.
- Physics authority: one headless `packages/game-core` module. Rendering never owns rules or a second Rapier world. `@react-three/rapier` is intentionally excluded.
- Simulation: fixed 120 Hz regardless of display refresh. Local physics runs in a Web Worker; browser snapshots currently arrive at up to 60 Hz.
- Arena: long open wooden school desk with no rails. Falling must remain visible; elimination occurs only at a lower death plane.
- Shot: pull backward and release. Direction is opposite the drag; progressive power gives low-power control; off-center `applyImpulseAtPoint()` produces natural torque.
- Input: one Pointer Events path for mouse, touch, and stylus.
- Turn flow: `AIMING → MOVING → SETTLING → AIMING/ROUND_OVER → MATCH_OVER`. No repeat shot while bodies move.
- Timer: 15 seconds. If no valid completed `ShotCommand` reaches the authority, pass the turn. Never auto-release an unfinished drag because V1 sends no continuous aim state.
- Rules: best of five/first to three round wins; alternating round starter; 20-shot round draw limit.
- Fairness: six cosmetic colors share identical physics. Color selection must never change gameplay properties.
- Visual direction: nostalgic classroom, pale green walls, black chalkboard scorecard, white tiled floor, full long scratched wooden desk with visible legs, controlled top-to-bottom perspective, paper ticket HUD. The reference’s “Nostalgic Website” overlay was explicitly rejected and removed.
- Camera: controlled perspective, no OrbitControls during matches. The desk, board, floor, and both fighters should remain legible in landscape and portrait.
- Resilience: one WebGL canvas during play. A complete DOM/CSS classroom remains beneath it so disabled WebGL produces a designed fallback rather than a blank green screen.
- Multiplayer direction: eventually authoritative WebSocket server; clients send shot intent only. Server simulates results and broadcasts about 20 Hz. Continuous `AimUpdate` traffic is outside V1.

## What was implemented

### Repository foundation

- Converted the initial Create Next App checkout into npm workspaces:
  - `apps/web`
  - `packages/protocol`
  - `packages/game-core`
  - `e2e`
- Added strict shared TypeScript configuration, Vitest, and Playwright.
- Next.js currently uses version 16.3.1 and React 19.2.8.

### Protocol and rules

- Zod schemas for phases, cosmetics, finite vectors, normalized `ShotCommand`, and the client-room message union.
- Snapshot, event, result, body, and player types shared across modules.
- Headless Rapier simulation with a narrow `GameSimulation` interface.
- Rounded-cuboid sharpener colliders, correct mass/friction/restitution/damping, gravity, CCD, tabletop, and classroom floor.
- Command rejection for invalid, stale, wrong-match/round/turn/phase, duplicate, and illegal-hit-point shots.
- Torque from local hit point, contact events with normalized strength, visible fall start, death-plane elimination, settling detection, turn switch, timeout pass, rounds, draws, and match completion.

### Browser experience

- Stationery-case selection screen with six colors, persistent selection, a CSS-rendered realistic preview, and a lock-in transition.
- Procedural 3D sharpener including body, inlet, blade, screw, underside, PBR materials, and active-player highlight.
- Full 3D classroom: blackboard scoreboard, pale wall, tiled floor, generated wood grain/scratches, long desk, visible legs, lighting, shadow, and fog.
- Unified mouse/touch/stylus drag path, aim guideline, vertical power meter, timer ticket, a persistent top-right sound menu, reset/replay, and result cards.
- Hybrid audio: continuous 50%-volume playground MP3 after the first user gesture; asset-backed sharpener collision; simultaneous bell/winner playback at match end with a seven-second winner cutoff; synthesized flick, wood, scrape, falling, floor, and room cues. Music and SFX mute independently and persist.
- Responsive portrait and landscape presentation with no forced-rotation gate.

### Feel tuning requested during implementation

The first prototype launched sharpeners off the table too easily. The accepted direction was the recommended tactical tuning: a long desk, `0.054 N·s` maximum impulse, `power01 = drag01^1.7`, 0.28 m drag cap, balanced friction/damping, and CCD. This preserves strong knockout shots while giving weak and medium pulls useful control.

### WebGL failure repair

A sandboxed Chrome instance reported `GL_VENDOR = Disabled`, `GL_RENDERER = Disabled`, and failed to create a WebGL context. Because the scene lived entirely in Three.js, the HUD remained over a blank green background.

The repair:

- removed the unnecessary R3F Canvas from the selector and replaced it with a detailed CSS sharpener;
- changed the match renderer from forced `high-performance` to browser-default power preference;
- added an explicit WebGL capability probe;
- kept a complete DOM classroom under the 3D layer;
- skipped renderer construction and displayed a useful status when WebGL is unavailable;
- added a forced-no-WebGL Playwright regression;
- added `apps/web/app/icon.svg`, eliminating the final favicon 404.

Interactive physics still requires WebGL. The fallback is an honest visual/error state, not a fake second game engine.

### Classroom realism and input-integrity pass

- Replaced flat classroom surfaces with deterministic procedural PBR sets: amber varnished wood, aged satin ceramic tiles with recessed grout, and softly varied painted plaster.
- Refined visual bevels and metal response on the sharpener body, blade, screw/washer, desk perimeter, and wall baseboard without changing colliders or physics tuning.
- Tightened the controlled camera modestly while keeping the full desk, legs, board, and floor readable.
- Added monotonic render tiers: high uses DPR 1.5, 2048 shadows, and optional half-resolution N8AO; balanced uses DPR 1.25 and 1024 native shadows; low uses DPR 1 and 512 native shadows. Coarse/narrow displays start balanced. N8AO capability or runtime failure downgrades to balanced without removing the scene.
- Fixed four presentation/input defects without changing simulation behavior: stale drags cannot release after a timeout, power UI shows eased impulse power, visual hit points are clamped into legal collider bounds, and display transforms now interpolate instead of being reset by React props.
- Split the former 1,045-line global stylesheet into scoped selector, match UI, and static-classroom CSS modules; global CSS now contains only shared tokens and primitives.

### Asset audio and winner-report pass

- Added deployment copies of all four supplied MP3 files under `apps/web/public/audio`; the repository-root `public/audio` directory is not served by the nested Next.js workspace.
- Background music begins on the first legal browser interaction, loops continuously through selector/match transitions at 50% volume, and can be muted separately from SFX through the persistent top-right speaker menu.
- Sharpener-to-sharpener contacts use the supplied collision sample. A match win starts the bell and winner effect together once; the winner effect stops after seven seconds.
- Replaced the small match-over status with a classroom-paper winner report showing winner, final score, rounds, turns, and Play Again.

## Current verified checkpoint

At the end of the asset-audio and winner-report implementation:

- `npm test`: 50 tests passed across 10 files.
- `npm run typecheck`: passed for every workspace.
- `npm run lint`: passed.
- `npm run build`: passed on Next.js 16.3.1; `/`, `/_not-found`, and `/icon.svg` were generated.
- `npm run test:e2e`: 8 Chrome journeys passed: selection/shot, portrait usability, supplied-audio/menu persistence, winner audio/report/replay, expired-drag cancellation, reset-drag invalidation, unsupported-N8AO fallback, and forced-no-WebGL fallback.
- Browser console audit: no errors in the deterministic arena, top-right audio-menu, or winner-report screenshot runs.
- `git diff --check`: passed.

The unit suite may print a Rapier compatibility initialization deprecation warning; it was non-failing at this checkpoint.

## Current gaps—do not describe as shipped

- No computer bot or bot Worker.
- No friend invites, lobby, room codes, matchmaking, presence, or in-game chat.
- No WebSocket/realtime server despite the reserved root `dev:realtime` script.
- No server-authoritative simulation, 20 Hz network snapshots, reconciliation, reconnect/reclaim, or load test.
- No accounts, authentication, database, profiles, progression, inventory, or monetization.
- No Blender/GLB asset pipeline; all current art is code/CSS/procedural geometry.
- No deployment configuration or production URL.
- No gamepad/keyboard aiming path.

Recommended next product order remains:

1. Playtest and tune the local flick, collisions, torque, settling, camera, and mobile gesture until the game feels excellent.
2. Add a seeded computer opponent through the same `ShotCommand` interface.
3. Specify and build the authoritative realtime room server, then friend invites and reconnection.
4. Add accounts/persistence only when the match loop and networking justify them.

## Handoff cautions

- This checkpoint combines the physics-first vertical slice, classroom realism/input-integrity pass, and asset-audio/winner-report pass. Verify the live branch and `git status --short` before new work.
- Commits, pushes, deployments, rebases, discards, and destructive cleanup require explicit user authorization.
- The root-level legacy Create Next App paths were replaced by `apps/web`; use the workspace paths as runtime truth.
- `Architecture.md` is the lookup map for changes. Avoid copying its file-by-file detail back into this memory; this file should remain a compact rationale and milestone record.
- When the implementation changes, record only durable decisions and milestone outcomes here. Keep raw chat transcripts, speculative ideas, and repeated file maps out of this file.
