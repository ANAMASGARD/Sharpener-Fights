# Sharpener Fights architecture

> Authoritative current-state map for maintainers and coding agents. Audited against the repository on 2026-08-22. Code is the final authority; update this file whenever ownership, runtime flow, public contracts, or dependencies change.

## Product boundary

Sharpener Fights is a turn-based 3D browser game. Pool-style pull-back aiming applies an impulse at a body-local point, so a compact asymmetric sharpener can slide, spin, tip, collide, fall off an open desk, and be eliminated only below the death plane.

The repository contains:

- public sharpener selection, Local Play, and PWA/offline support;
- one headless Rapier physics/rules implementation shared by local play, prediction, and online resolution;
- Clerk-authenticated private invitations and compatible FIFO matchmaking;
- Vercel route-handler authority backed by Upstash Redis;
- Liveblocks connectivity, presence, room-scoped access tokens, preset emotes, and revision notifications;
- a realistic procedural classroom, responsive Pointer Events controls, audio, best-of-five scoring, and WebGL fallback.

Online code is implemented, but a live deployment is not operational until Clerk, Liveblocks, Upstash, identity-HMAC, and webhook secrets are configured and a two-browser acceptance/load run passes. There is no computer bot, persistent progression, inventory, leaderboard, monetization, free-text chat, or GLB asset pipeline.

## System shape

```text
Browser
  Pointer Events ──► ShotCommand ─────────────────────────────┐
       │                                                     │
       ├─ Local Play ─► game.worker.ts ─► game-core/Rapier   │
       │                                                     │
       └─ Online prediction                                  │
                       │                                     ▼
                       └──────── POST Vercel action route ─► multiplayer-core
                                                                  │
                                                      restore GameCheckpoint
                                                      run fixed 1/120 ticks
                                                      build PlaybackState
                                                                  │
                               ┌──────────────────────────────────┴─────────────────┐
                               ▼                                                    ▼
                         Upstash Redis                                        Liveblocks
                         authoritative state                                  notification only
                         revisions/checkpoints                                presence/emotes
                         deadlines/locks                                      no Storage
                         invites/queue
                               │                                                    │
                               └──────── revision recovery ◄───────────────────────┘
```

The authoritative order is always:

1. validate Clerk identity, origin, body, versions, membership, rate limits, and controller lease;
2. acquire the room lease and re-read the current Redis revision;
3. restore the internal checkpoint and validate/apply the command in `game-core`;
4. resolve bounded fixed 120 Hz ticks as quickly as server CPU permits;
5. atomically fence and commit the next Redis revision, deadline, idempotency result, and bounded playback history;
6. return the authoritative response to the caller;
7. use Next.js `after()` to broadcast a Liveblocks `MATCH_UPDATED` notification.

Redis remains correct if the broadcast fails. Liveblocks events mean “revision N exists”; they are never the record of truth.

## Workspace and dependency direction

```text
sharpenerfight/
├── apps/web/                         Next.js 16 browser UI and Vercel backend adapters
├── packages/protocol/                public Zod wire schemas and shared identifiers
├── packages/game-core/               headless Rapier physics and match rules
├── packages/multiplayer-core/        provider-independent authoritative workflows
├── e2e/                              browser journeys
├── e2e-pwa/                          production PWA/offline journeys
├── memory/memory.md                  compact milestone history
├── Architecture.md                   this ownership map
├── AGENTS.md                         agent operating rules
└── README.md                         human setup and quick start
```

Allowed imports:

```text
packages/protocol                  (no workspace dependency)
        ▲
        ├── packages/game-core
        ├── packages/multiplayer-core ──► packages/game-core
        └── apps/web ───────────────────► all three packages
```

Provider SDKs (`@upstash/redis`, `@liveblocks/node`, Clerk, Next.js) stay under `apps/web/server` or route handlers. `packages/multiplayer-core` imports none of them. `packages/game-core` imports no React, Three.js, DOM, provider, or presentation code.

## Canonical ownership map

### Public protocol

| Path | Responsibility |
| --- | --- |
| `packages/protocol/src/game.ts` | `ShotCommand`, snapshots, match phases/events, cosmetic IDs, safety-draw reason |
| `packages/protocol/src/multiplayer.ts` | protocol/game/physics versions; actions; lobby views; public playback states/resolutions; recovery; invite/queue/controller/API schemas; Liveblocks event envelopes |
| `packages/protocol/src/room.ts` | room modes/statuses, lobby players, six preset emotes |
| `packages/protocol/src/worker.ts` | local Worker messages only |

Every network or cross-process payload starts here and is runtime-validated. `GameCheckpoint` is deliberately absent: it is internal server state, not a browser contract.

### Physics and rules

| Path | Responsibility |
| --- | --- |
| `packages/game-core/src/game-simulation.ts` | sole rules authority; turn timer, scoring, falling/elimination, checkpoint create/restore, forfeits, safety draw |
| `packages/game-core/src/physics-world.ts` | Rapier world, rigid bodies, colliders, CCD, impulses-at-points, contacts, body restoration |
| `packages/game-core/src/physics-config.ts` | fixed 120 Hz and all canonical physical/rule constants |
| `packages/game-core/src/shot-validation.ts` | legality checks for match/round/turn/phase/hit point |
| `packages/game-core/src/prediction.ts` | browser prediction and authoritative snapshot rebase using the same physics |
| `packages/game-core/src/checkpoint.test.ts` | server checkpoint invariants and deterministic restore behavior |

The 15-second timer passes a turn; it never auto-releases an unfinished drag. A shot that remains physically active for the established 20-second simulation ceiling becomes an unscored `SAFETY_LIMIT` round draw. Unexpected CPU or payload-budget failures are infrastructure faults: Redis marks the room `PAUSED_ERROR`; the server never fabricates a result.

### Multiplayer domain

| Path | Responsibility |
| --- | --- |
| `packages/multiplayer-core/src/multiplayer-service.ts` | friend saga, invite claim, FIFO pairing, actions, lazy deadlines, resolver, recovery, controller reclaim, disconnect handling |
| `packages/multiplayer-core/src/models.ts` | server-only room/invite/ticket/controller/deadline records containing internal checkpoints; controller leases persist separately from room snapshots |
| `packages/multiplayer-core/src/ports.ts` | authority-store, realtime-publisher, presence-reader, clock/ID/hash boundaries |
| `packages/multiplayer-core/src/playback.ts` | checkpoint-independent public playback conversion and canonical state hash |
| `packages/multiplayer-core/src/testing/memory-authority-store.ts` | deterministic test adapter only; never a production fallback |

The multiplayer service owns workflows, not HTTP. It receives verified pseudonymous identities and returns typed domain results. Request IDs are Redis idempotency metadata and are not stored in physics checkpoints.

### Vercel/provider adapters

| Path | Responsibility |
| --- | --- |
| `apps/web/server/runtime.ts` | warm-instance singleton composition of service, Redis, Liveblocks, IDs, and hashes |
| `apps/web/server/http.ts` | request size/origin checks, version construction, parallel account/IP/room limits, safe error mapping |
| `apps/web/server/adapters/identity-adapter.ts` | Clerk authentication and stable HMAC pseudonymous public user IDs |
| `apps/web/server/adapters/upstash-authority-store.ts` | Redis persistence, token/revision fencing, Lua commits, invite claims, queue pairing, leases, disconnect/reclaim |
| `apps/web/server/adapters/upstash-rate-limiter.ts` | fixed-window Redis rate limits |
| `apps/web/server/adapters/liveblocks-adapter.ts` | private transport rooms, access tokens, server events, and active-user reads |

All room-level Lua begins with `#!lua flags=allow-key-locking` and declares every touched key in `KEYS`, allowing unrelated rooms to execute concurrently. Room keys are scoped as `sf:match:{roomId}:state|lock|history|idempotency:*`; per-seat controller leases use independent `controller:{seat}` keys so a renewal cannot overwrite a concurrent physics revision. Queues are partitioned as `sf:queue:{region}:{gameVersion}:*`. Queue status polling renews the authenticated ticket heartbeat, and a per-partition account index prevents duplicate active tickets. Lock release compares the random token. Final commits compare both lock token and expected revision. Friend operations, invite claims, and action idempotency are scoped to the authenticated pseudonymous user so client-generated IDs cannot cross account boundaries.

### Route handlers

| Route | Responsibility |
| --- | --- |
| `POST /api/friends` | idempotent friend-room provisioning and hashed one-use invite |
| `GET/POST /api/invites/[code]` | public preview and authenticated atomic claim |
| `POST/GET/DELETE /api/matchmaking` | compatible FIFO join, jitter/backoff polling, cancel |
| `GET /api/matches/[roomId]?afterRevision=N` | membership-checked `DELTA` or `FULL` Redis recovery |
| `POST /api/matches/[roomId]/actions` | canonical actions; Redis commit then `after()` Liveblocks notification |
| `POST /api/matches/[roomId]/controller` | one controlling-tab lease, renewal, explicit takeover, reconnect resume |
| `POST /api/liveblocks-auth` | Redis membership check then one-room `*:read` + `storage:none` access token |
| `POST /api/liveblocks-webhook` | signed, idempotent advisory disconnect input; exact controlling connection only |

State-changing cookie-authenticated routes validate same-origin browser metadata, bounded JSON, Clerk identity, and account/IP/room rate limits. Invite pages set `Referrer-Policy: no-referrer`; only SHA-256 invite hashes reach Redis. Secrets, raw Clerk IDs, checkpoints, tokens, and invite URLs must not be logged.

### Browser multiplayer

| Path | Responsibility |
| --- | --- |
| `apps/web/features/multiplayer/multiplayer-api.ts` | same-origin typed HTTP client, build/version envelope, operation/client IDs |
| `apps/web/features/multiplayer/liveblocks-client.ts` | one Liveblocks client using `/api/liveblocks-auth`; no Storage |
| `apps/web/features/multiplayer/use-online-match.ts` | admission, server-event validation, revisions, recovery, prediction/rebase, deadlines, controller renew/takeover |
| `apps/web/features/multiplayer/playback.ts` | fixed-step visual playback of public shot resolutions and timed events |
| `friend-room-launcher.tsx` | real friend creation, native share, WhatsApp/Telegram/Facebook/X/email/copy controls |
| `invite-experience.tsx` | preview, auth, cosmetic selection, atomic claim, code removal from browser history |
| `queue-experience.tsx` | compatible FIFO queue with 0.5/1/2/3-second capped polling backoff |
| `online-match-experience.tsx` | lobby/ready/reconnect/error/take-control and six-emote presentation |

The client accepts a Liveblocks match event only when it validates, matches the room and pinned versions, and has server metadata (`user === null`, `connectionId === -1`). Each update carries the current public `MatchView`; delta recovery also returns that view so deadlines and lobby state cannot drift while physics replays. Stale revisions are discarded. A consecutive shot resolution replays locally and then rebases the shared prediction world to its authoritative final state; a gap or non-shot revision fetches Redis authority. A randomized 5–10-second safety poll, reconnection, and tab visibility recovery prevent a missed notification from stalling the match.

### Local game and renderer

| Path | Responsibility |
| --- | --- |
| `apps/web/features/match/game.worker.ts` | only local simulation instance and fixed-step accumulator |
| `use-game-worker.ts`, `match-view.tsx` | Worker/online feed adapters into shared presentation |
| `aim.ts`, `aim-session.ts` | pointer pull-back direction/power and body-local hit point |
| `match-arena.tsx`, `match-scene.tsx`, `match-fighter.tsx` | R3F rendering, seat orientation, input whitelist, interpolation |
| `classroom-environment.tsx`, `classroom-materials.ts`, `classroom-props.tsx` | procedural classroom, PBR surfaces, decorative raycast-excluded props |
| `sharpener-appearance.ts`, `sharpener-geometry.ts`, `sharpener-model.tsx` | shared recognizable sharpener proportions and presentation-only cosmetics |
| `static-classroom.tsx` | useful desk/board/floor DOM fallback when WebGL is unavailable |

Local physics remains a Worker-owned fixed 120 Hz simulation. Online serverless resolution also steps at 120 Hz but is event-driven: idle/aiming rooms consume no continuous server CPU. Rendering never owns Rapier and `@react-three/rapier` remains banned.

## Provisioning and failure rules

Friend and instant room creation use an explicit saga:

```text
Redis PROVISIONING + seat/invite or pairing
        ↓
Liveblocks private room (idempotent)
        ↓
Redis READY

failure → PROVISIONING_FAILED; never expose a half-ready room as playable
```

Friend retries reuse the same account-scoped operation ID. A matched queue ticket retries idempotent Liveblocks provisioning during status polling, so an invocation that committed Redis and then lost the provider call can recover without creating another authoritative room.

Liveblocks broadcasts are scheduled with `after()`, never an un-awaited promise. If publication fails, the committed Redis revision and bounded last-16 resolution log recover the other browser. If the browser is further behind, the API returns a full public playback state.

A controller tab renews a 30-second Redis lease. Multiple tabs may observe, but only that client instance can act. When Liveblocks reports the exact controlling connection gone and confirms it is no longer active, Redis starts a reconnect deadline. A passive tab can explicitly take control and atomically resume. Forfeit requires an expired controller lease plus a successful Liveblocks presence read; presence-provider failure fails closed.

## Rendering, audio, and PWA invariants

- Physics is fixed 120 Hz; display FPS and DPR never alter simulation.
- Mouse, touch, and pen share Pointer Events.
- Cosmetics never change mass, collider, impulse, friction, damping, or rules.
- Decorative classroom meshes are excluded from gameplay raycasts and colliders.
- N8AO is the only optional post-process, high-tier only, and must fail back to balanced rendering.
- The central fight desk and fighters retain readability before decorative detail.
- Music/SFX preferences are independent; supplied MP3 effects are deduplicated by accepted shot/contact/win identity.
- Public selector/modes/Local Play are installable/offline. Auth, APIs, invites, queues, and online rooms remain network-only.
- WebGL failure must retain the DOM classroom instead of a blank page.

## Required configuration

See `.env.example`. Online operation requires:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
APP_IDENTITY_SECRET
LIVEBLOCKS_SECRET_KEY
LIVEBLOCKS_WEBHOOK_SECRET
UPSTASH_REDIS_REST_URL (or KV_REST_API_URL)
UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_TOKEN)
NEXT_PUBLIC_BUILD_ID
```

Create a Liveblocks webhook for `/api/liveblocks-webhook`. Deploy Vercel functions in/near the Upstash primary region. Never expose server secrets through `NEXT_PUBLIC_*`.

## Verification and release gates

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run test:pwa
git diff --check
```

Provider-independent tests use the in-memory authority adapter. Release additionally requires:

- two real Clerk accounts completing Friend and Instant flows in separate browsers;
- invitation single-use/expiry and browser-history checks;
- dropped notification, stale/out-of-order revision, reconnect, passive-tab takeover, and false-forfeit checks;
- 20-room full-browser smoke, 100-room protocol and simultaneous-shot bursts, 500-entry queue storm, and 100-client reconnect storm;
- p50/p95/p99 action latency, resolver CPU/ticks/bytes, Redis command and lock metrics, Liveblocks failure/recovery rate, and cost per completed match.

Do not call online PvP production-ready until provider credentials are provisioned and these external gates pass.
