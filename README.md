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
- client prediction with authoritative in-place rebase, exact-session 30-second reconnect, ready/countdown/rematch, and six preset emotes.

Bots, database persistence/progression, production deployment configuration, and distributed room state remain later phases. Local and online play deliberately share one headless physics/rules core.

## Workspace

```text
apps/web              Next.js client and R3F renderer
apps/realtime         Colyseus rooms and Clerk verification
packages/protocol     Validated commands, snapshots, and events
packages/game-core    Headless Rapier simulation and match rules
e2e                   Playwright browser smoke tests
```

## Run locally

Copy `.env.example` to `.env.local`/your process environment and fill the Clerk keys. Then run:

```bash
npm install
npm run dev:realtime
npm run dev
```

Open <http://localhost:3000>, sign in, choose a sharpener, then choose Local Play, Friend, or Instant Match. Portrait and landscape layouts are both supported.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build --workspace=@sharpener/web
npm run test:e2e
```

The Playwright test uses an installed Google Chrome channel. The unit suite may print a Rapier initialization deprecation warning from the compatibility package; it does not currently fail or affect the simulation checks.

`render.yaml` contains the Singapore realtime-service blueprint. Configure the Clerk secrets, allowed frontend origin, and a shared build ID in Render; configure the matching public realtime URLs/build ID and Clerk keys in the Vercel web project.

### Vercel monorepo settings

The Next.js package lives below the repository root. Configure the Vercel web
project as follows; do not add `next` to the root `package.json` merely to make
framework detection pass.

```text
Root Directory: apps/web
Include source files outside of the Root Directory: enabled
Framework Preset: Next.js
Build Command: automatic
Install Command: automatic
Output Directory: automatic
```

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
