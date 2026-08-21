# Sharpener Fights architecture

> Authoritative current-state map for maintainers and coding agents. Last audited against the live repository on 2026-08-21. When this file and code disagree, verify the code and update this file in the same change.

## 1. Product and current scope

Sharpener Fights is a turn-based browser physics game. A player grabs a sharpener, pulls backward as in a pool game, and releases. Drag direction and distance become an impulse; the local grab point becomes the impulse point, so off-center shots naturally generate torque. There are no desk-edge walls. A sharpener can slide, spin, tip, fall, hit the floor, and is eliminated only after crossing a death plane.

The repository implements both the local same-device match and the first authenticated online PvP vertical slice. Clerk protects play routes, Colyseus owns room/session lifecycle, and `apps/realtime` runs server-authoritative `game-core` simulations for private friend invitations and strict-FIFO instant matchmaking. There is still no computer opponent, database-backed progression, inventory, monetization, or provisioned production deployment.

## 2. Architectural shape

```text
Pointer Events → aim.ts → validated ShotCommand
                         │
          ┌──────────────┴────────────────┐
          ▼                               ▼
local game.worker.ts                 Colyseus FightRoom
120 Hz worker authority             120 Hz server authority
          │                               │
          └── GameSnapshot/GameEvent ─────┘
                         │
                         ▼
             MatchFeed → R3F/HUD/audio
```

Local play posts commands to one Worker and receives snapshots at up to 60 Hz. Online play predicts a legal local release through `PredictionSimulation`, sends the same command to the room authority, and rebases in place onto monotonically sequenced `GAME_FRAME` snapshots at 20 Hz. The server decides command legality, physics, timers, falls, scores, forfeits, and match outcome.

The core seam is `GameSimulation`. Callers know how to reset, apply a validated shot, advance one fixed tick, read a snapshot, drain events, inspect phase, and dispose. Rapier bodies, colliders, contact queues, timers, and round transitions stay inside the implementation.

## 3. Workspace and dependency direction

```text
sharpenerfight/
├── apps/web/                  Next.js browser application
├── apps/realtime/             Colyseus authoritative rooms and Clerk verification
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
apps/web ───────────────► packages/game-core ──► packages/protocol
apps/realtime ──────────► packages/game-core ──► packages/protocol
apps/web ───────────────────────────────────────► packages/protocol
apps/realtime ──────────────────────────────────► packages/protocol
```

`packages/protocol` has no dependency on the other workspace packages. `packages/game-core` remains headless and is shared by the local Worker, server authority, and browser predictor. Neither application owns a second rules implementation.

## 4. File ownership map

### Application entry and global presentation

| Path | Owns | Change here when |
| --- | --- | --- |
| `apps/web/app/page.tsx` | Home route entry | The route should mount a different top-level experience |
| `apps/web/components/game-loader.tsx` | Client-only dynamic loading | Loading behavior or the client/SSR seam changes |
| `apps/web/features/match/game-experience.tsx` | Authenticated selector-to-mode transition | Changing the post-selection destination |
| `apps/web/proxy.ts`, `apps/web/lib/auth-gate.ts`, `apps/web/lib/auth-redirects.ts` | Clerk request context, resource-level page authorization, missing-environment fail-closed UI, and same-origin post-authentication destinations | Changing authentication coverage, setup behavior, or where completed sign-in/sign-up flows return |
| `apps/web/app/modes`, `queue`, `invite`, `play` | Mode, matchmaking, invite, and local/online route entries | Changing the multiplayer journey or route boundary |
| `apps/web/app/layout.tsx` | Metadata and viewport | Changing title, description, viewport policy, or theme color |
| `apps/web/vercel.json` | App-scoped Vercel framework detection | Changing the web deployment framework configuration |
| `vercel.json` | Root-project Vercel compatibility build that delegates to `@sharpener/web` | Supporting an existing Vercel project whose Root Directory is still the repository root |
| `apps/web/app/icon.svg` | Browser/app icon | Changing the favicon artwork |
| `apps/web/app/globals.css` | Global fonts, design tokens, reset, loading state, accessibility utility, and reduced-motion policy | Changing truly global presentation only |
| `apps/web/features/match/sharpener-selector.module.css` | Scoped selector case and deep CSS 3D cosmetic-preview presentation | Changing the selection screen, horizontal spin, preview materials, or responsive layout |
| `apps/web/features/match/match-ui.module.css` | Scoped match canvas and HUD presentation | Changing the turn ticket, power meter, match controls, or result overlays |
| `apps/web/features/match/static-classroom.module.css` | Scoped no-WebGL classroom artwork | Changing the resilient DOM fallback composition |

### Selection and cosmetics

| Path | Owns | Change here when |
| --- | --- | --- |
| `apps/web/features/match/sharpener-selector.tsx` | Pre-match stationery case, color choices, persistence, audio feedback, and lock-in transition | Changing selection flow rather than preview interaction or anatomy |
| `apps/web/features/match/sharpener-preview.tsx` | Interactive CSS 3D preview anatomy, pointer capture, two-axis manual rotation, keyboard rotation, and automatic-spin pause/resume | Changing the selector sharpener shape or how users inspect it |
| `apps/web/features/match/sharpener-appearance.ts` | Shared visual proportions and plastic/aluminium material profiles for selector and match models | Changing the recognizable shape hierarchy or cosmetic material response without changing physics |
| `apps/web/features/match/sharpener-geometry.ts` | Pure Three.js construction of the beveled, inlet-cut classic-sharpener body | Changing the match body silhouette while retaining an independently testable collider envelope |
| `apps/web/features/match/sharpener-appearance.test.ts` | Visible-body/collider occupancy, compact-proportion, and cosmetic-material invariants | Any selector or match sharpener geometry/material redesign |
| `apps/web/features/match/cosmetics.ts` | Cosmetic names and body/edge/highlight colors; local-storage selection helpers; fair opponent-color choice | Recoloring an existing sharpener or changing cosmetic presentation data |
| `packages/protocol/src/game.ts` | Allowed cosmetic IDs | Adding, removing, or renaming a cosmetic ID |
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
| `apps/web/features/match/match-canvas.tsx` | Thin local-worker-to-`MatchView` adapter | Changing local match feed ownership |
| `apps/web/features/match/match-view.tsx` | Shared local/online classroom, quality, audio, seat transform, and HUD composition | Changing the renderer-facing match contract |
| `apps/web/features/match/match-arena.tsx`, `match-scene.tsx`, `match-fighter.tsx`, `match-hud.tsx` | Canvas setup, scene composition, fighter gesture/render interpolation, and HUD | Changing camera, scene, input, or match UI without coupling them |
| `apps/web/features/match/presentation-space.ts` | Reversible Seat A/Seat B position, direction, quaternion, and effect mapping | Changing per-seat orientation or inverse aiming |
| `apps/web/features/match/aim.ts` | Pure pull-back vector, dead zone, progressive power curve, center assist, and legal local-hit projection | Tuning drag feel or aiming mathematics |
| `apps/web/features/match/aim-session.ts` | Immutable drag authority and turn-scoped power visibility | Changing how an in-progress client gesture responds to turn changes |
| `apps/web/features/match/aim.test.ts` | Aim behavior contract | Any aiming calculation changes |
| `apps/web/features/match/sharpener-model.tsx` | R3F assembly of the shared procedural body, inlet tunnel/bezel, mounted blade/channel, screw, underside, and PBR materials | Changing how shared appearance parts are assembled or lit in the match |
| `apps/web/features/match/classroom-environment.tsx` | 3D wall, blackboard, desk, floor geometry, lighting, shadows, and fog | Changing the interactive classroom composition |
| `apps/web/features/match/classroom-materials.ts` | Deterministic procedural wood, ceramic-tile, and plaster PBR texture sets | Changing classroom surface color, grain, roughness, bump detail, or texture budgets |
| `apps/web/features/match/classroom-board-texture.ts` | Injected local-date formatting and deterministic powder-chalk scoreboard texture | Changing board typography, date format, chalk dust, ghost marks, or scoreboard texture generation |
| `apps/web/features/match/classroom-props.tsx` | Raycast-excluded procedural perimeter desks, benches, bags, bottles, lunchboxes, dustbin, instancing, and quality-aware decorative shadows | Changing the visual classroom population without adding gameplay colliders or input targets |
| `apps/web/features/match/render-quality.ts` | High/balanced/low render budgets and monotonic degradation policy | Changing DPR, shadow, anisotropy, or optional-effect budgets |
| `apps/web/features/match/quality-effects.tsx` | Lazy high-tier effects boundary; balanced/low tiers do not load the post-processing chunk | Changing optional-effect loading or module/lifecycle failure behavior |
| `apps/web/features/match/high-tier-effects.tsx` | High-tier half-resolution N8AO, final AgX tone mapping, and guarded frame rendering | Tuning ambient occlusion or the high-tier post-processing pipeline |
| `apps/web/features/match/static-classroom.tsx` | DOM fallback structure and fallback score values | Changing the no-WebGL classroom markup |
| `apps/web/features/match/webgl-support.ts` | WebGL capability probe | Changing renderer availability policy |

The interactive 3D sharpener is currently procedural; there are no `.glb` assets or Blender export pipeline yet. `SHARPENER_APPEARANCE` is the canonical visual contract for both presentations: a short body-dominant single-hole school sharpener, an oversized readable inlet, a short secondary blade plate, one screw, and unchanged geometry across cosmetics. The five colored finishes use satin plastic; Aluminium changes material response only. The match body occupies `0.049 × 0.023 × 0.035 m` inside the unchanged `0.050 × 0.024 × 0.036 m` Rapier collider, filling 98% of X and 97.2% of Z so visible contact remains close to physical contact.

The selector renders the same visual hierarchy as a deep CSS 3D solid with a sixteen-second horizontal-axis rotation, prominent circular end opening, low molded shoulder, short metal blade, screw, and modeled underside. An independent six-face core sits `0.06rem` behind the decorative skin; its shared coordinate system and opaque two-sided faces keep the body closed at edge-on and underside rotations without making surface details responsible for enclosure. Pointer Events and pointer capture let mouse, touch, and pen rotate the preview around both axes; arrow keys provide the keyboard equivalent. Automatic rotation pauses during inspection and resumes shortly after release. Reduced-motion mode disables only the automatic spin, leaving manual inspection available. It intentionally avoids another R3F canvas so the application consumes only one WebGL context during a match.

### Local simulation adapter

| Path | Owns | Change here when |
| --- | --- | --- |
| `apps/web/features/match/game.worker.ts` | Rapier initialization, accumulator loop, fixed stepping, snapshot/event delivery, worker command adapter | Changing local scheduling, worker messages, or snapshot cadence |
| `apps/web/features/match/use-game-worker.ts` | React lifecycle for the Worker and UI-facing `snapshot/events/acceptedShotId/error/shoot/reset` interface | Changing how React connects to the simulation worker |

The Worker is the only owner of the local `GameSimulation`. It advances at 120 Hz using an accumulator, clamps long frame gaps to 250 ms, caps catch-up at 30 ticks per loop, and posts snapshots/events at up to 60 Hz. R3F then lerps/slerps its display groups toward the latest body snapshot. That smoothing is presentation, not physics interpolation or prediction.

### Online session and authoritative service

| Path | Owns |
| --- | --- |
| `apps/web/features/multiplayer/realtime-session.ts` | Authenticated SDK client, active room handoff, and tab-scoped reconnect token |
| `apps/web/features/multiplayer/use-online-match.ts` | Sequenced frame intake, prediction/rebase, shot-audio deduplication, and room lobby adaptation |
| `apps/web/features/multiplayer/mode-selector.tsx`, `queue-experience.tsx`, `invite-experience.tsx`, `online-match-experience.tsx` | Friend, FIFO queue, invite preview/color, ready/countdown, rematch, and preset-emote UX |
| `apps/realtime/src/fight-room.ts` | Colyseus transport adapter, authenticated seats, reconnect, messages, and lobby Schema synchronization |
| `apps/realtime/src/queue-room.ts` | Strict-FIFO queue transport and creation of reserved instant rooms |
| `apps/realtime/src/room-controller.ts` | Transport-independent authoritative room lifecycle and 120/20 Hz orchestration |
| `apps/realtime/src/multiplayer-registry.ts` | One-seat-per-account/session reclaim, invite lifecycle, FIFO queue, and rate limits |
| `apps/realtime/src/identity-authority.ts` | Clerk JWT verification, trusted profile cache, and active-session reconnect verification |
| `apps/realtime/src/lobby-state.ts` | Low-frequency Colyseus Schema lobby metadata only |

High-frequency body transforms travel only in the validated custom `GAME_FRAME` message. Schema does not duplicate them. Every frame carries `protocolVersion`, `frameSeq`, and `serverTick`; clients reject incompatible schemas and discard duplicate/out-of-order frames. The fixed-step accumulator caps catch-up and closes a room only after sustained overload rather than permitting an unbounded backlog.

### Audio

| Path | Owns | Change here when |
| --- | --- | --- |
| `apps/web/features/match/audio.ts` | Event-to-cue mapping, Web Audio synthesis, media-effect routing, slide loop, ambience, preferences serialization | Changing sounds, mix levels, audio persistence, or physics-event sonification |
| `apps/web/features/match/media-audio.ts` | Long-lived HTML media elements for background, selector, lock-in, attack, collision, and victory MP3 playback | Changing asset paths, loop/volume policy, effect deduplication, or victory cutoff behavior |
| `apps/web/features/match/use-audio-preferences.ts` | Shared first-interaction unlock, preference state, persistence, and independent toggles | Changing how Music/SFX settings behave across screens |
| `apps/web/features/match/audio-menu.tsx` | Persistent top-right speaker menu | Changing the sound-settings UI |
| `apps/web/features/match/use-game-audio.ts` | React adapter for authoritative worker acceptance, physics events, slide motion, and one-shot match victory playback | Changing how worker messages, snapshots, or events drive the audio director |
| `apps/web/features/match/audio.test.ts` | Cue and preference behavior | Audio mapping or storage behavior changes |

Audio uses a hybrid pipeline. Web Audio synthesizes wood, floor, falling, slide, and subtle room cues. One shared HTML-media controller plays files from `apps/web/public/audio`: playground music loops at volume `0.5`; actual selector changes use `Selection-click.mp3`; Lock In uses `Lock-IN-sound.mp3`; accepted attacks use `Sharpener-click.mp3`; collision contact uses the supplied sharpener MP3; and match victory starts the school bell plus winner effect together while stopping the winner effect after seven seconds. Attack playback is deduplicated by `shotId`. The local worker posts `COMMAND_ACCEPTED` immediately after `game-core` accepts a shot; online prediction uses the same shot ID before server confirmation, so the later authoritative acceptance cannot replay it. Audio unlock occurs on the first pointer/keyboard gesture because browsers block audible autoplay. The singleton controller lives above selector/match transitions, so music does not restart between screens. Media play rejection cannot break gameplay.

| Event | Cue |
| --- | --- |
| `COMMAND_ACCEPTED` (local worker) / `SHOT_ACCEPTED` | deduplicated `/audio/Sharpener-click.mp3` |
| `FALL_STARTED` | falling whoosh |
| sharpener/sharpener contact | `/audio/sharpener-collision.mp3` |
| sharpener/table contact | wood impact |
| sharpener/floor contact | floor thud |
| horizontal surface velocity | continuous scrape/slide level |
| first user interaction | looping `/audio/PlayGround-BG.mp3` at 50% volume |
| actual cosmetic change | `/audio/Selection-click.mp3` |
| Lock In | `/audio/Lock-IN-sound.mp3` |
| `MATCH_OVER` transition | school bell plus first seven seconds of winner effect |

### Shared protocol

`packages/protocol/src/index.ts` is a small barrel over `common.ts`, `game.ts`, `room.ts`, `realtime.ts`, and `worker.ts`. It owns:

- `MatchPhaseSchema` and `MatchPhase`;
- cosmetic IDs;
- finite vectors and the validated `ShotCommandSchema`;
- `PlayerIndex`, `CommandResult`, `BodySnapshot`, `GameSnapshot`, and `GameEvent`;
- version/build admission, room/queue options, lobby/invite metadata, preset emotes, worker messages, and client/server realtime messages;
- sequenced `GAME_FRAME`, accepted-shot, seat, queue, invite, error, and resynchronization contracts.

Any future worker or network message that crosses a trust/process seam should have its shared shape and runtime validation here. Do not move presentation-only drag state into the protocol for V1. The authority never receives continuous aiming updates.

### Physics and match rules

`packages/game-core/src/index.ts` is the single rules authority. Its external interface is:

```ts
interface GameSimulation {
  reset(config?: Partial<MatchConfig>): void;
  applyCommand(command: ShotCommand): CommandResult;
  forfeit(loser: PlayerIndex): void;
  step(): void;
  getSnapshot(): GameSnapshot;
  drainEvents(): GameEvent[];
  getPhase(): MatchPhase;
  dispose(): void;
}
```

`createGameSimulation()` asynchronously initializes Rapier and returns that interface. `PhysicsWorld` is the shared internal body owner; `PredictionSimulation.restoreSnapshot()` updates body transforms and velocities in place instead of rebuilding Rapier on every network frame.

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

The match uses one R3F `<Canvas>` and a monotonic adaptive quality policy. Fine-pointer viewports at least 900 px wide start at high quality (DPR 1.5, 2048 shadows, anisotropy 8, optional half-resolution N8AO); coarse/narrow displays start balanced (DPR 1.25, 1024 shadows, anisotropy 4); sustained low performance can degrade through balanced to low (DPR 1, 512 shadows, anisotropy 2). Decorative shadow casting degrades independently from full on high, to major furniture/bags on balanced, to none on low; central desk and sharpener shadows remain. Quality never rises during a match. N8AO is the only optional post-processing pass, requires WebGL2 plus float color buffers, is isolated behind an error boundary, and failure downgrades to balanced without removing the Canvas.

`ResponsiveCamera` uses separate portrait and landscape positions/FOV while preserving a controlled elevated perspective and complete desk/blackboard composition; there are no OrbitControls during play. R3F display groups initialize once per fighter/round and then lerp/slerp exclusively toward snapshots, so React updates do not defeat interpolation.

`ClassroomEnvironment` builds all current 3D scenery in code:

- Deterministic Canvas-generated wood albedo, roughness, and bump detail;
- deterministic satin-marble ceramic and two-tone painted-plaster PBR texture sets;
- an injected match-load date and deterministic powder-chalk blackboard score texture;
- long rounded desk and visual metal legs;
- four instanced perimeter desk/bench clusters with two bags, bottles, lunchboxes, and a dustbin;
- beveled wall baseboard, tile/grout floor, soft window light, shadows, hemisphere fill, and fog.

All classroom/environment meshes use `NO_RAYCAST`. Only sharpener render geometry begins Pointer Event aiming; pointer movement continues to intersect the explicit mathematical desk plane. Classroom decoration can receive light and shadows but cannot become a gameplay hit target. Props are visual-only and have no Rapier bodies or colliders.

`supportsWebGL()` probes WebGL2 then WebGL and releases the probe context. `StaticClassroom` is always mounted beneath the R3F layer. When WebGL is unavailable, the R3F canvas is not constructed and the DOM scene remains visible with a hardware-acceleration notice. Keep the fallback structurally independent from Three.js so renderer failure cannot erase it.

## 8. Persistence and external state

The realtime service is ephemeral and in-memory: rooms, queue entries, invites, rate-limit windows, and profile cache disappear on process restart. There is no application database. Clerk is the trusted identity provider; the server verifies tokens and active reconnect sessions rather than trusting browser profile fields. Browser-local state is:

| Key | Value |
| --- | --- |
| `sharpener-fights:cosmetic` | One validated cosmetic ID |
| `sharpener-fights:audio` | `{ sfxMuted, musicMuted }` JSON; legacy `ambienceMuted` is migrated on read |
| tab `sessionStorage` reconnect key | Colyseus room reconnection token; cleared with the tab/session |

Malformed cosmetic/audio values fall back to defaults. Local scores reset on reload; online scores live only for the lifetime of the authoritative room.

## 9. Test architecture

| Test surface | Files | Protects |
| --- | --- | --- |
| Protocol validation | `packages/protocol/src/index.test.ts` | normalized finite commands and valid cosmetics |
| Rules/physics interface | `packages/game-core/src/index.test.ts` | 120 Hz stepping, legal shots, torque, CCD profile, timer pass, fall/death sequence, contact events, rounds, match win, shot-limit draw |
| Pure aiming | `apps/web/features/match/aim.test.ts` | direction, progressive power, cap, dead zone, center assist |
| Client turn authority | `apps/web/features/match/aim-session.test.ts` | stale-drag rejection and turn-scoped power visibility |
| Render quality | `apps/web/features/match/render-quality.test.ts` | device classification, render budgets, N8AO capability gate, monotonic degradation |
| Blackboard presentation | `apps/web/features/match/classroom-board-texture.test.ts` | manually zero-padded injected `DD/MM/YYYY` formatting |
| Sharpener appearance | `apps/web/features/match/sharpener-appearance.test.ts` | collider-envelope occupancy, classic compact proportions, blade/body hierarchy, and cosmetic-only material response |
| Cosmetics | `apps/web/features/match/cosmetics.test.ts` | six fair choices, distinct opponent color, storage validation |
| Authentication return | `apps/web/lib/auth-redirects.test.ts` | completed sign-in/sign-up flows return to the same-origin game home instead of Clerk's hosted default redirect |
| Audio | `audio.test.ts`, `media-audio.test.ts` | event mapping, preference migration, loop/volume, independent mute, collision, simultaneous victory, seven-second cutoff, and reset |
| Match summary | `apps/web/features/match/match-summary.test.ts` | winner label, final score, rounds, and turns |
| Browser journey | `e2e/local-match.spec.ts` | enclosed selector shell across six cosmetics/extreme poses, selection, pointer release, decoration raycast exclusion, audio menu/playback calls/assets, timeout-drag cancellation, quality fallback, portrait usability, enriched DOM classroom, WebGL-disabled fallback |
| Realtime protocol/authority | `packages/protocol/src/realtime.test.ts`, `apps/realtime/src/*test.ts` | versioned joins, lobby-only Schema, exact-session reconnect, rate limits, FIFO queue, invitation expiry, authoritative shots, overload policy, and twenty-room local authority load |
| Seat/frame presentation | `presentation-space.test.ts`, `frame-sequence.test.ts` | Seat A/B round trips, inverse input/effects, and stale authoritative-frame rejection |

Use the `GameSimulation` interface for rules tests. Avoid testing physics by reproducing its internal calculations in UI tests.

Playwright owns port 3100 and sets a development-only `NEXT_PUBLIC_E2E_AUTH_BYPASS`; production builds cannot activate that bypass. Keeping E2E off the normal port prevents an unrelated developer server from silently changing test configuration.

## 10. Common change recipes

| Requested change | Primary file(s) | Required follow-through |
| --- | --- | --- |
| Recolor an existing sharpener | `cosmetics.ts` | Run cosmetic tests and visually inspect selector, R3F, and fallback |
| Add/remove/rename a color | `protocol/src/game.ts`, `cosmetics.ts` | Update protocol/cosmetic tests and any saved-value migration policy |
| Change shared sharpener proportions/material identity | `sharpener-appearance.ts`, `sharpener-geometry.ts`, `sharpener-model.tsx`, `sharpener-preview.tsx` | Update appearance tests first; preserve collider occupancy or explicitly reconcile `PHYSICS.sharpenerHalfExtents` |
| Change selector preview anatomy or inspection controls | `sharpener-preview.tsx`, `sharpener-selector.module.css` | Keep it DOM/CSS; preserve the shared hole/blade/screw hierarchy, verify pointer and keyboard rotation, and confirm there is no selector canvas |
| Change desk/board/floor appearance | `classroom-environment.tsx`, `classroom-materials.ts`, and `static-classroom.module.css` | Keep interactive and fallback compositions aligned |
| Change perimeter furniture or props | `classroom-props.tsx`, `static-classroom.tsx`, and `static-classroom.module.css` | Keep props outside the tabletop, preserve `NO_RAYCAST`, and remeasure draw calls/triangles/frame time |
| Change camera/top-down framing | `ResponsiveCamera` in `match-scene.tsx` | Check desktop, portrait, table edges, floor, board, HUD, and pointer hit areas |
| Tune shot strength/feel | `aim.ts`, `PHYSICS.maxImpulse`, friction/damping in game core | Change tests first; test weak/medium/max pulls and edge falls in browser |
| Change timer/scoring/round rules | `PHYSICS` and state transitions in game core | Update protocol if externally visible shape changes; extend core tests |
| Add/change synthesized sound | `audio.ts` | Prefer physics events as triggers; update audio tests and unlock behavior |
| Add/change MP3 music/effect | `apps/web/public/audio`, `media-audio.ts` | Verify exact casing, browser asset response, mute ownership, and media-controller tests |
| Change worker cadence | `game.worker.ts` | Preserve fixed 120 Hz authority; benchmark and test catch-up behavior |
| Add a protocol message | `packages/protocol` first | Validate at the receiving authority and add schema tests |
| Diagnose a blank arena | `webgl-support.ts`, `static-classroom.tsx`, browser console | Preserve no-WebGL E2E coverage; do not add another Canvas |
| Change matchmaking/invites | `multiplayer-registry.ts`, `queue-room.ts`, `fight-room.ts` | Preserve account limits, FIFO ordering, invite entropy/expiry, exact-session seat reclaim, and protocol validation |
| Change online frame flow | `room-controller.ts`, `realtime.ts`, `use-online-match.ts` | Keep one 120 Hz authority, one 20 Hz transform stream, sequence rejection, bounded catch-up, and in-place prediction rebase |

## 11. Planned architecture, not implemented

Computer play remains future work. A seeded bot should run outside rendering and submit the same `ShotCommand` interface; no bot participates in Friend or Instant rooms. Database persistence, progression, inventory, leaderboards, moderation tooling, production observability, and distributed queue/presence are also not implemented. `render.yaml` defines the Singapore realtime service, but no production service or secrets are provisioned. The current in-memory service is appropriate for one-process beta validation, not horizontal scaling. The preferred Vercel project configuration uses `apps/web` as its Root Directory with outside-root sources enabled. For the existing repository-root Vercel project, the root `vercel.json` delegates directly to `@sharpener/web`, and the root manifest exposes the same pinned Next.js version solely for Vercel framework detection. Both paths build the same application and shared npm workspaces.

## 12. Known constraints and maintenance notes

- Next.js is pinned to 16.3.1. Read installed documentation under `node_modules/next/dist/docs/` before Next-specific edits.
- `apps/web/next.config.ts` transpiles the workspace packages and disables the detached TypeScript CLI in the managed environment because its output was lost; `npm run typecheck` remains an explicit gate.
- R3F/Three cannot provide interactive 3D when the browser disables WebGL. The DOM fallback is visual and explanatory, not a second playable engine.
- AudioContext creation and audible HTML-media playback must remain behind a user gesture.
- Clerk and the realtime server require the environment variables documented in `.env.example`; without them the web app shows an explicit setup screen rather than silently bypassing authentication.
- Zustand and Howler are installed but unused in the current implementation. Do not assume they own state or audio.
- The current 3D environment and sharpener are procedural. Asset loading, compression, shader prewarming, and GLB budgets remain future concerns.
- The project is not deterministic across different Rapier/Wasm builds for lockstep; online outcomes therefore remain server-authoritative and browser simulation is prediction only.
