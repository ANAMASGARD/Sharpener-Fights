# Sharpener Fights architecture

> Authoritative current-state map for maintainers and coding agents. Last audited against the live repository on 2026-08-20. When this file and code disagree, verify the code and update this file in the same change.

## 1. Product and current scope

Sharpener Fights is a turn-based browser physics game. A player grabs a sharpener, pulls backward as in a pool game, and releases. Drag direction and distance become an impulse; the local grab point becomes the impulse point, so off-center shots naturally generate torque. There are no desk-edge walls. A sharpener can slide, spin, tip, fall, hit the floor, and is eliminated only after crossing a death plane.

The current repository implements a local same-device vertical slice. Both turns are controlled in the same browser. It includes the physics game, selection screen, responsive classroom presentation, audio, scoring, tests, and a WebGL-disabled fallback. It does not yet include a computer opponent, friend invitations, authentication, matchmaking, realtime rooms, databases, or a server.

## 2. Architectural shape

```text
Browser pointer input
        │
        ▼
apps/web/features/match/aim.ts
pure drag → direction/power calculation
        │
        ▼ ShotCommand
packages/protocol
validated shared vocabulary
        │
        ▼ postMessage
apps/web/features/match/game.worker.ts
120 Hz fixed-step owner
        │
        ▼
packages/game-core
Rapier physics + rules authority
        │
        ├── GameSnapshot at up to 60 Hz ──► React/R3F rendering + HUD
        └── GameEvent batches ────────────► Web Audio feedback
```

The core seam is `GameSimulation`. Callers know how to reset, apply a validated shot, advance one fixed tick, read a snapshot, drain events, inspect phase, and dispose. Rapier bodies, colliders, contact queues, timers, and round transitions stay inside the implementation.

## 3. Workspace and dependency direction

```text
sharpenerfight/
├── apps/web/                  Next.js browser application
├── packages/protocol/         Shared runtime schemas and TypeScript types
├── packages/game-core/        Headless Rapier simulation and match rules
├── e2e/                       Playwright full-browser journeys
├── memory/                    Compact project history and handoff state
├── Architecture.md            This ownership and runtime map
├── AGENTS.md                  Always-loaded agent operating contract
├── README.md                  Human quick start
├── package.json               npm workspace orchestration
├── playwright.config.ts       Chrome E2E configuration
├── vitest.config.ts           Unit-test discovery and coverage configuration
└── tsconfig.base.json         Shared strict TypeScript defaults
```

Allowed dependency direction:

```text
apps/web ─────────► packages/game-core ─────────► packages/protocol
    └───────────────────────────────────────────► packages/protocol
```

`packages/protocol` has no dependency on the other workspace packages. `packages/game-core` must remain headless. `apps/web` adapts browser input, rendering, storage, and audio to those deeper modules.

## 4. File ownership map

### Application entry and global presentation

| Path | Owns | Change here when |
| --- | --- | --- |
| `apps/web/app/page.tsx` | Home route entry | The route should mount a different top-level experience |
| `apps/web/components/game-loader.tsx` | Client-only dynamic loading | Loading behavior or the client/SSR seam changes |
| `apps/web/features/match/game-experience.tsx` | Selector-to-match screen transition | Adding a lobby, menu, mode selection, or other top-level game screen |
| `apps/web/app/layout.tsx` | Metadata and viewport | Changing title, description, viewport policy, or theme color |
| `apps/web/app/icon.svg` | Browser/app icon | Changing the favicon artwork |
| `apps/web/app/globals.css` | Global fonts, design tokens, reset, loading state, accessibility utility, and reduced-motion policy | Changing truly global presentation only |
| `apps/web/features/match/sharpener-selector.module.css` | Scoped selector case and cosmetic-preview presentation | Changing the selection screen or its responsive layout |
| `apps/web/features/match/match-ui.module.css` | Scoped match canvas and HUD presentation | Changing the turn ticket, power meter, match controls, or result overlays |
| `apps/web/features/match/static-classroom.module.css` | Scoped no-WebGL classroom artwork | Changing the resilient DOM fallback composition |

### Selection and cosmetics

| Path | Owns | Change here when |
| --- | --- | --- |
| `apps/web/features/match/sharpener-selector.tsx` | Pre-match stationery case, color choices, lock-in transition, CSS preview markup | Changing selection UX or preview anatomy |
| `apps/web/features/match/cosmetics.ts` | Cosmetic names and body/edge/highlight colors; local-storage selection helpers; fair opponent-color choice | Recoloring an existing sharpener or changing cosmetic presentation data |
| `packages/protocol/src/index.ts` | Allowed cosmetic IDs | Adding, removing, or renaming a cosmetic ID |
| `apps/web/features/match/cosmetics.test.ts` | Cosmetic fairness and persistence contract | Cosmetic IDs, selection, or storage behavior changes |

Current color source of truth:

| ID | Display name | Body | Edge | Highlight |
| --- | --- | --- | --- | --- |
| `ember-red` | Ember Red | `#bd3f27` | `#762316` | `#f58b61` |
| `ocean-blue` | Ocean Blue | `#1688a8` | `#07536d` | `#64c7d9` |
| `sunflower-yellow` | Sunflower | `#d8a91f` | `#89640b` | `#f5d96e` |
| `classroom-green` | Classroom Green | `#4e8a58` | `#285031` | `#8fc795` |
| `graphite-black` | Graphite | `#34383a` | `#151718` | `#747b7e` |
| `aluminium-silver` | Aluminium | `#a7aa9f` | `#5d625f` | `#e4e5dc` |

Changing the three hex values in `cosmetics.ts` updates the 3D model, selector preview, and DOM classroom fallback because all three consume the same cosmetic record. Adding an ID also requires updating `SharpenerCosmeticIdSchema` and its tests.

### Match UI, input, and rendering

| Path | Owns | Change here when |
| --- | --- | --- |
| `apps/web/features/match/match-canvas.tsx` | R3F canvas, camera, pointer gesture adapter, quality selection, aim line, render interpolation, HUD, turn/power/result controls | Changing match interaction, camera framing, HUD markup, or snapshot-to-scene adaptation |
| `apps/web/features/match/aim.ts` | Pure pull-back vector, dead zone, progressive power curve, center assist, and legal local-hit projection | Tuning drag feel or aiming mathematics |
| `apps/web/features/match/aim-session.ts` | Immutable drag authority and turn-scoped power visibility | Changing how an in-progress client gesture responds to turn changes |
| `apps/web/features/match/aim.test.ts` | Aim behavior contract | Any aiming calculation changes |
| `apps/web/features/match/sharpener-model.tsx` | Procedural Three.js sharpener geometry and PBR materials | Changing 3D shape, hole, blade, screw, scale, or material response |
| `apps/web/features/match/classroom-environment.tsx` | 3D wall, blackboard, desk, floor geometry, lighting, shadows, and fog | Changing the interactive classroom composition |
| `apps/web/features/match/classroom-materials.ts` | Deterministic procedural wood, ceramic-tile, and plaster PBR texture sets | Changing classroom surface color, grain, roughness, bump detail, or texture budgets |
| `apps/web/features/match/render-quality.ts` | High/balanced/low render budgets and monotonic degradation policy | Changing DPR, shadow, anisotropy, or optional-effect budgets |
| `apps/web/features/match/quality-effects.tsx` | Lazy high-tier effects boundary; balanced/low tiers do not load the post-processing chunk | Changing optional-effect loading or module/lifecycle failure behavior |
| `apps/web/features/match/high-tier-effects.tsx` | High-tier half-resolution N8AO, final AgX tone mapping, and guarded frame rendering | Tuning ambient occlusion or the high-tier post-processing pipeline |
| `apps/web/features/match/static-classroom.tsx` | DOM fallback structure and fallback score values | Changing the no-WebGL classroom markup |
| `apps/web/features/match/webgl-support.ts` | WebGL capability probe | Changing renderer availability policy |

The interactive 3D sharpener is currently procedural; there are no `.glb` assets or Blender export pipeline yet. The selector intentionally uses CSS rather than another R3F canvas so the application consumes only one WebGL context during a match.

### Local simulation adapter

| Path | Owns | Change here when |
| --- | --- | --- |
| `apps/web/features/match/game.worker.ts` | Rapier initialization, accumulator loop, fixed stepping, snapshot/event delivery, worker command adapter | Changing local scheduling, worker messages, or snapshot cadence |
| `apps/web/features/match/use-game-worker.ts` | React lifecycle for the Worker and UI-facing `snapshot/events/error/shoot/reset` interface | Changing how React connects to the simulation worker |

The Worker is the only owner of the local `GameSimulation`. It advances at 120 Hz using an accumulator, clamps long frame gaps to 250 ms, caps catch-up at 30 ticks per loop, and posts snapshots/events at up to 60 Hz. R3F then lerps/slerps its display groups toward the latest body snapshot. That smoothing is presentation, not physics interpolation or prediction.

### Audio

| Path | Owns | Change here when |
| --- | --- | --- |
| `apps/web/features/match/audio.ts` | Event-to-cue mapping, Web Audio synthesis, slide loop, ambience, preferences serialization | Changing sounds, mix levels, audio persistence, or physics-event sonification |
| `apps/web/features/match/media-audio.ts` | Long-lived HTML media elements for background, collision, and victory MP3 playback | Changing asset paths, loop/volume policy, or victory cutoff behavior |
| `apps/web/features/match/use-audio-preferences.ts` | Shared first-interaction unlock, preference state, persistence, and independent toggles | Changing how Music/SFX settings behave across screens |
| `apps/web/features/match/audio-menu.tsx` | Persistent top-right speaker menu | Changing the sound-settings UI |
| `apps/web/features/match/use-game-audio.ts` | React adapter for physics events, slide motion, and one-shot match victory playback | Changing how snapshots/events drive the audio director |
| `apps/web/features/match/audio.test.ts` | Cue and preference behavior | Audio mapping or storage behavior changes |

Audio uses a hybrid pipeline. Web Audio synthesizes flick, wood, floor, falling, slide, and subtle room cues. One shared HTML-media controller plays files from `apps/web/public/audio`: playground music loops at volume `0.5`, collision contact uses the supplied sharpener MP3, and match victory starts the school bell plus winner effect together while stopping the winner effect after seven seconds. Audio unlock occurs on the first pointer/keyboard gesture because browsers block audible autoplay. The singleton controller lives above selector/match transitions, so music does not restart between screens. Media play rejection cannot break gameplay.

| Event | Cue |
| --- | --- |
| `SHOT_ACCEPTED` | flick |
| `FALL_STARTED` | falling whoosh |
| sharpener/sharpener contact | `/audio/sharpener-collision.mp3` |
| sharpener/table contact | wood impact |
| sharpener/floor contact | floor thud |
| horizontal surface velocity | continuous scrape/slide level |
| first user interaction | looping `/audio/PlayGround-BG.mp3` at 50% volume |
| `MATCH_OVER` transition | school bell plus first seven seconds of winner effect |

### Shared protocol

`packages/protocol/src/index.ts` is the serialization seam. It owns:

- `MatchPhaseSchema` and `MatchPhase`;
- cosmetic IDs;
- finite vectors and the validated `ShotCommandSchema`;
- `PlayerIndex`, `CommandResult`, `BodySnapshot`, `GameSnapshot`, and `GameEvent`;
- `ClientRoomMessageSchema`, currently containing only completed shot commands.

Any future worker or network message that crosses a trust/process seam should have its shared shape and runtime validation here. Do not move presentation-only drag state into the protocol for V1. The authority never receives continuous aiming updates.

### Physics and match rules

`packages/game-core/src/index.ts` is the single rules authority. Its external interface is:

```ts
interface GameSimulation {
  reset(config?: Partial<MatchConfig>): void;
  applyCommand(command: ShotCommand): CommandResult;
  step(): void;
  getSnapshot(): GameSnapshot;
  drainEvents(): GameEvent[];
  getPhase(): MatchPhase;
  dispose(): void;
}
```

`createGameSimulation()` asynchronously initializes Rapier and returns that interface. Tests and future server adapters should use this seam rather than reaching into Rapier internals.

## 5. Coordinate system and physical arena

- Three.js/Rapier use meters and Y-up coordinates.
- The tabletop is centered at the world origin. Its surface is `y = 0`.
- X runs across the desk width; Z runs along the desk length.
- Player 0 starts at `z = 0.36` (screen-bottom side); player 1 starts at `z = -0.36`.
- The visible/physical floor is around `y = -0.74`.
- A body may visibly fall and hit the floor before elimination; elimination occurs below `y = -0.45`.

Current `PHYSICS` constants:

| Setting | Value |
| --- | ---: |
| Fixed rate | 120 Hz |
| Gravity | `-9.81 m/s²` |
| Sharpener mass | `0.022 kg` |
| Sharpener half-extents | `0.025 × 0.012 × 0.018 m` |
| Table half-extents | `0.42 × 0.025 × 0.65 m` |
| Table/sharpener friction | `0.42 / 0.42` |
| Table/sharpener restitution | `0.08 / 0.18` |
| Linear/angular damping | `0.12 / 0.4` |
| Maximum impulse | `0.054 N·s` |
| Death plane | `y = -0.45 m` |
| Aim timer | 15 seconds |
| Settled thresholds | `< 0.03 m/s` linear and `< 0.15 rad/s` angular |
| Required settled time | 0.5 seconds |
| Round-over presentation | 2 seconds |
| Shot limit | 20 per round |
| Match win | first to 3 rounds |

Sharpener colliders are rounded cuboids with CCD enabled. The tabletop and floor are fixed cuboids. Detailed blade/hole geometry is visual only and does not define collision shape.

## 6. Shot and turn flow

### Gesture-to-command

1. Pointer down is accepted only on the active sharpener during `AIMING`.
2. The grab point is converted from world to sharpener-local coordinates and softly centered only inside an 8 mm assist radius.
3. Pointer movement is intersected with the desk plane.
4. `calculateShot()` subtracts current position from start position, creating the release direction opposite the pull.
5. Drags shorter than 8 mm cancel. Drag distance is capped at 0.28 m.
6. Normalized drag is shaped by `power01 = drag01^1.7`, preserving fine control at low power.
7. Release emits one completed `ShotCommand` with identity fields, normalized direction, power, and local hit point.
8. The core validates match/round/turn/phase, duplicate shot ID, normalized finite values, and hit-point bounds before applying `maxImpulse × power01` at the point.

Off-center `applyImpulseAtPoint()` produces torque through Rapier rather than a separate spin formula.

### State machine

```text
    AIMING ── timer expires ──► AIMING (other active player)
       │
       └── valid shot ──► MOVING ◄──────────────┐
                            │                   │ body speeds rise
                            ▼                   │
                         SETTLING ──────────────┘
                            │
                 settled for 0.5 s
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
    AIMING (next turn)            round outcome
                                         │
                            ┌────────────┴───────────┐
                            ▼                        ▼
                     ROUND_OVER                 MATCH_OVER
                         │ 2 s                   (reset only)
                         ▼
                AIMING (next round)
```

During `MOVING` and `SETTLING`, no shot is accepted. A death-plane crossing resolves knockout/double-fall before normal settling. Twenty settled shots without a knockout end the round as a draw. Round starters alternate. A match ends when a player reaches three round wins; reset starts a new match.

Timer expiry changes the active player and increments `turnId` while remaining in `AIMING`. It passes the turn; the server/worker cannot auto-release a drag it never received.

## 7. Rendering and resilience

The match uses one R3F `<Canvas>` and a monotonic adaptive quality policy. Fine-pointer viewports at least 900 px wide start at high quality (DPR 1.5, 2048 shadows, anisotropy 8, optional half-resolution N8AO); coarse/narrow displays start balanced (DPR 1.25, 1024 shadows, anisotropy 4); sustained low performance can degrade through balanced to low (DPR 1, 512 shadows, anisotropy 2). Quality never rises during a match. N8AO requires WebGL2 plus float color buffers, is isolated behind an error boundary, and failure downgrades to balanced without removing the Canvas.

`ResponsiveCamera` uses separate portrait and landscape positions/FOV while preserving a controlled elevated perspective and complete desk/blackboard composition; there are no OrbitControls during play. R3F display groups initialize once per fighter/round and then lerp/slerp exclusively toward snapshots, so React updates do not defeat interpolation.

`ClassroomEnvironment` builds all current 3D scenery in code:

- Deterministic Canvas-generated wood albedo, roughness, and bump detail;
- deterministic aged-ceramic and painted-plaster PBR texture sets;
- Canvas-generated blackboard score texture;
- long rounded desk and visual metal legs;
- beveled wall baseboard, tile/grout floor, soft window light, shadows, hemisphere fill, and fog.

`supportsWebGL()` probes WebGL2 then WebGL and releases the probe context. `StaticClassroom` is always mounted beneath the R3F layer. When WebGL is unavailable, the R3F canvas is not constructed and the DOM scene remains visible with a hardware-acceleration notice. Keep the fallback structurally independent from Three.js so renderer failure cannot erase it.

## 8. Persistence and external state

There is no database or backend. Browser-local preferences are:

| Key | Value |
| --- | --- |
| `sharpener-fights:cosmetic` | One validated cosmetic ID |
| `sharpener-fights:audio` | `{ sfxMuted, musicMuted }` JSON; legacy `ambienceMuted` is migrated on read |

Malformed or unknown values fall back to defaults. Scores and matches are in-memory and reset on reload.

## 9. Test architecture

| Test surface | Files | Protects |
| --- | --- | --- |
| Protocol validation | `packages/protocol/src/index.test.ts` | normalized finite commands and valid cosmetics |
| Rules/physics interface | `packages/game-core/src/index.test.ts` | 120 Hz stepping, legal shots, torque, CCD profile, timer pass, fall/death sequence, contact events, rounds, match win, shot-limit draw |
| Pure aiming | `apps/web/features/match/aim.test.ts` | direction, progressive power, cap, dead zone, center assist |
| Client turn authority | `apps/web/features/match/aim-session.test.ts` | stale-drag rejection and turn-scoped power visibility |
| Render quality | `apps/web/features/match/render-quality.test.ts` | device classification, render budgets, N8AO capability gate, monotonic degradation |
| Cosmetics | `apps/web/features/match/cosmetics.test.ts` | six fair choices, distinct opponent color, storage validation |
| Audio | `audio.test.ts`, `media-audio.test.ts` | event mapping, preference migration, loop/volume, independent mute, collision, simultaneous victory, seven-second cutoff, and reset |
| Match summary | `apps/web/features/match/match-summary.test.ts` | winner label, final score, rounds, and turns |
| Browser journey | `e2e/local-match.spec.ts` | selection, pointer release, audio menu/playback calls/assets, timeout-drag cancellation, quality fallback, portrait usability, DOM classroom, WebGL-disabled fallback |

Use the `GameSimulation` interface for rules tests. Avoid testing physics by reproducing its internal calculations in UI tests.

## 10. Common change recipes

| Requested change | Primary file(s) | Required follow-through |
| --- | --- | --- |
| Recolor an existing sharpener | `cosmetics.ts` | Run cosmetic tests and visually inspect selector, R3F, and fallback |
| Add/remove/rename a color | `protocol/src/index.ts`, `cosmetics.ts` | Update protocol/cosmetic tests and any saved-value migration policy |
| Change sharpener 3D shape | `sharpener-model.tsx` | If physical dimensions change, deliberately reconcile `PHYSICS.sharpenerHalfExtents` and tests |
| Change selector preview anatomy | `sharpener-selector.tsx`, `sharpener-selector.module.css` | Keep it DOM/CSS; verify there is no selector canvas |
| Change desk/board/floor appearance | `classroom-environment.tsx`, `classroom-materials.ts`, and `static-classroom.module.css` | Keep interactive and fallback compositions aligned |
| Change camera/top-down framing | `ResponsiveCamera` in `match-canvas.tsx` | Check desktop, portrait, table edges, floor, board, HUD, and pointer hit areas |
| Tune shot strength/feel | `aim.ts`, `PHYSICS.maxImpulse`, friction/damping in game core | Change tests first; test weak/medium/max pulls and edge falls in browser |
| Change timer/scoring/round rules | `PHYSICS` and state transitions in game core | Update protocol if externally visible shape changes; extend core tests |
| Add/change synthesized sound | `audio.ts` | Prefer physics events as triggers; update audio tests and unlock behavior |
| Add/change MP3 music/effect | `apps/web/public/audio`, `media-audio.ts` | Verify exact casing, browser asset response, mute ownership, and media-controller tests |
| Change worker cadence | `game.worker.ts` | Preserve fixed 120 Hz authority; benchmark and test catch-up behavior |
| Add a protocol message | `packages/protocol` first | Validate at the receiving authority and add schema tests |
| Diagnose a blank arena | `webgl-support.ts`, `static-classroom.tsx`, browser console | Preserve no-WebGL E2E coverage; do not add another Canvas |

## 11. Planned architecture, not implemented

Future online PvP should keep `packages/game-core` as the shared simulation module but instantiate the authoritative copy in a dedicated realtime server. The client should send only validated completed shot commands such as direction, power, local hit point, and turn identity. The server should simulate the result, reject stale/illegal commands, and broadcast snapshots around 20 Hz. Client prediction can improve feel, but server results decide wins. Continuous `AimUpdate` networking remains outside V1.

Computer play should run a seeded bot adapter in a Worker and submit the same `ShotCommand` interface as a human. Friend invites, rooms, reconnection, authentication, and persistence need explicit designs and tests before being described as available.

Likely future workspace additions are `apps/realtime` for the authoritative WebSocket server and a bot module/package, but these paths do not exist yet. The root `dev:realtime` script is reserved for that future workspace and currently has no target.

## 12. Known constraints and maintenance notes

- Next.js is pinned to 16.3.1. Read installed documentation under `node_modules/next/dist/docs/` before Next-specific edits.
- `apps/web/next.config.ts` transpiles the workspace packages and disables the detached TypeScript CLI in the managed environment because its output was lost; `npm run typecheck` remains an explicit gate.
- R3F/Three cannot provide interactive 3D when the browser disables WebGL. The DOM fallback is visual and explanatory, not a second playable engine.
- AudioContext creation and audible HTML-media playback must remain behind a user gesture.
- The current worker snapshot type and worker message union are duplicated locally rather than runtime-validated on receipt. Introduce protocol schemas when this becomes a network trust seam.
- Zustand and Howler are installed but unused in the current implementation. Do not assume they own state or audio.
- The current 3D environment and sharpener are procedural. Asset loading, compression, shader prewarming, and GLB budgets remain future concerns.
- The project is not yet deterministic across different Rapier/Wasm builds for network lockstep; future multiplayer should be server-authoritative rather than trusting independent client outcomes.
