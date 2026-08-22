# Sharpener Fights

Physics-first browser prototype: 8 Ball Pool-style pull-and-release aiming applied to asymmetric 3D sharpeners on an open school desk.

## Current checkpoint

The vertical slice includes:

- one headless Rapier rules/physics core at a fixed 120 Hz;
- a Web Worker simulation loop and 60 Hz render snapshots;
- Three.js rendering through React Three Fiber (no second physics system);
- a reference-matched classroom with a full long desk, black chalkboard scoreboard, tiled floor, wall, and visible desk legs in portrait or landscape;
- a realistic procedural sharpener with six fair cosmetic colors and a pre-match stationery-case selector;
- shared mouse, touch, and pen input through Pointer Events;
- tactical progressive pull-back power, direct hit-point torque, CCD, gravity, physical desk-edge falls, and death-plane elimination;
- physics-driven flick, contact, scrape, fall, floor-impact, UI, and room-ambience audio with persistent mute controls;
- 15-second authoritative turn passing with no auto-release of unfinished drags;
- best-of-five rounds, a 20-shot draw limit, score HUD, and rematches;
- protocol, physics, selection, aim, and audio unit tests plus real Chrome selection/pointer/portrait smoke tests;
- Clerk-authenticated one-use Friend links and compatible FIFO Instant matchmaking;
- event-driven Vercel authority that restores a Redis checkpoint, resolves shared Rapier physics at fixed 120 Hz, and commits one fenced revision per action;
- Liveblocks room-scoped access tokens, connectivity/presence/revision notifications, client prediction/rebase, controlling-tab leases, ready/countdown/rematch, and six preset emotes—with no Liveblocks Storage;
- an installable desktop/mobile PWA with the supplied Sharpener Fights branding, an adaptive launcher emblem, iOS installation instructions, safe update consent, and fully offline guest Local Play.

Bots, player progression, inventory, and production provider acceptance/load verification remain later phases. Local and online play deliberately share one headless physics/rules core.

## Workspace

```text
apps/web              Next.js client and R3F renderer
packages/protocol     Validated commands, snapshots, and events
packages/game-core    Headless Rapier simulation and match rules
packages/multiplayer-core  Provider-independent authoritative workflows
e2e                   Playwright browser smoke tests
e2e-pwa               Production PWA install/offline browser tests
```

## Run locally

Local Play does not require Clerk or online providers. To enable Friend and Instant modes, copy `.env.example` to `apps/web/.env.local` (or your process environment) and fill the Clerk, Liveblocks, Upstash, and identity-secret values. Then run:

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, choose a sharpener, then choose Local Play, Friend, or Instant Match. Friend and Instant ask the user to sign in; Local Play remains guest-accessible. Portrait and landscape layouts are both supported.

The service worker is intentionally disabled under `npm run dev`, so development never inherits stale production caches. Installability and offline play are generated only by the production webpack build:

```bash
npm run build --workspace=@sharpener/web
npm run start --workspace=@sharpener/web
```

On supported desktop/Android browsers, the in-game Desk Ticket exposes the browser's real install prompt after engagement. iPhone/iPad users receive Share → Add to Home Screen → Open as Web App instructions. Dismissing the ticket hides it for fourteen days. The installed app keeps orientation unlocked; matches also include an optional Full Screen button.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build --workspace=@sharpener/web
npm run test:e2e
npm run test:pwa
```

`test:pwa` performs its own production build and uses localhost port 3200; run it serially from other browser suites. The Playwright tests use an installed Google Chrome channel. The unit suite may print a Rapier initialization deprecation warning from the compatibility package; it does not currently fail or affect the simulation checks.

Online authority runs in the Next.js application on Vercel. Upstash Redis is the durable/atomic authority; Liveblocks carries connections, presence, and revision notifications only. Configure both integrations in the Vercel project and place compute near the Redis primary region.

### Vercel monorepo settings

The Next.js package lives below the repository root. The preferred Vercel
configuration is:

```text
Root Directory: apps/web
Include source files outside of the Root Directory: enabled
Framework Preset: Next.js
Build Command: automatic
Install Command: automatic
Output Directory: automatic
```

The repository also carries a root `vercel.json` and a matching root
development declaration for Next.js. This compatibility entrypoint delegates
the build to `@sharpener/web` and emits `apps/web/.next`, so an existing Vercel
project still configured at the repository root can deploy without maintaining
a second application implementation.

Set these variables for every Vercel environment that should run the game:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
APP_IDENTITY_SECRET=<at-least-32-random-bytes>
LIVEBLOCKS_SECRET_KEY=<liveblocks-secret>
LIVEBLOCKS_WEBHOOK_SECRET=<liveblocks-webhook-signing-secret>
UPSTASH_REDIS_REST_URL=<upstash-rest-url>
UPSTASH_REDIS_REST_TOKEN=<upstash-rest-token>
NEXT_PUBLIC_BUILD_ID=<release-build-id>
```

Create a Liveblocks webhook pointing to `/api/liveblocks-webhook`. Redis decides
room membership; `/api/liveblocks-auth` grants one room-scoped access token with
`*:read` and `storage:none`. Public `NEXT_PUBLIC_*` values are captured during
`next build`, so redeploy after changing them.

Vercel injects its Git commit SHA into the PWA cache version automatically. For a non-Vercel production host, set `NEXT_PUBLIC_PWA_CACHE_VERSION` to a release identifier when you need an explicit cache namespace; content revisions still protect individual precached assets. The worker and generated source map are build artifacts and are not committed.
