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
- Clerk-authenticated Friend links and strict-FIFO Instant matchmaking;
- a Colyseus service that runs the shared Rapier authority at 120 Hz and sends sequenced 20 Hz frames;
- client prediction with authoritative in-place rebase, exact-session 30-second reconnect, ready/countdown/rematch, and six preset emotes;
- an installable desktop/mobile PWA with the supplied Sharpener Fights branding, an adaptive launcher emblem, iOS installation instructions, safe update consent, and fully offline guest Local Play.

Bots, database persistence/progression, production deployment configuration, and distributed room state remain later phases. Local and online play deliberately share one headless physics/rules core.

## Workspace

```text
apps/web              Next.js client and R3F renderer
apps/realtime         Colyseus rooms and Clerk verification
packages/protocol     Validated commands, snapshots, and events
packages/game-core    Headless Rapier simulation and match rules
e2e                   Playwright browser smoke tests
e2e-pwa               Production PWA install/offline browser tests
```

## Run locally

Local Play does not require Clerk or the realtime server. To enable Friend and Instant modes, copy `.env.example` to `.env.local`/your process environment and fill the Clerk/realtime values. Then run:

```bash
npm install
npm run dev:realtime
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

`render.yaml` contains the Singapore realtime-service blueprint. Configure the Clerk secrets, allowed frontend origin, and a shared build ID in Render; configure the matching public realtime URLs/build ID and Clerk keys in the Vercel web project.

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
NEXT_PUBLIC_REALTIME_URL=wss://<realtime-host>
NEXT_PUBLIC_REALTIME_HTTP_URL=https://<realtime-host>
NEXT_PUBLIC_BUILD_ID=<shared-build-id>
```

Deploy the Render blueprint first, then use its HTTPS hostname for the two
public realtime URLs. Render must use the same value for `BUILD_ID`, and its
`ALLOWED_WEB_ORIGINS` must include the stable Vercel production origin. Public
`NEXT_PUBLIC_*` values are captured during `next build`, so redeploy after
changing them. `CLERK_JWT_KEY` is optional and may remain empty.

Vercel injects its Git commit SHA into the PWA cache version automatically. For a non-Vercel production host, set `NEXT_PUBLIC_PWA_CACHE_VERSION` to a release identifier when you need an explicit cache namespace; content revisions still protect individual precached assets. The worker and generated source map are build artifacts and are not committed.
