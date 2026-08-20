# Game Audio and Victory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add continuous playground music, asset-backed collision and victory sounds, independent audio controls, and a replayable winner summary.

**Architecture:** A testable HTML-media controller owns supplied MP3 playback while the current Web Audio director retains synthesized physical cues. Audio preference/menu ownership moves to `GameExperience`, above selector and match screens; match snapshots drive one-shot victory playback and a pure helper drives winner statistics.

**Tech Stack:** Next.js 16, React 19, TypeScript, HTMLMediaElement, Web Audio API, Vitest, Playwright, CSS Modules.

---

### Task 1: Asset-backed media controller

**Files:**
- Create: `apps/web/features/match/media-audio.ts`
- Create: `apps/web/features/match/media-audio.test.ts`
- Modify: `apps/web/features/match/audio.ts`
- Modify: `apps/web/features/match/audio.test.ts`

- [ ] Write a failing test with injected fake audio elements proving that music loops at volume `0.5`, music and SFX mute independently, collision playback resets its media, victory tracks start together, the winner track is stopped by a `7000` ms scheduler, and reset cancels active victory playback.
- [ ] Run `npx vitest run apps/web/features/match/media-audio.test.ts apps/web/features/match/audio.test.ts` and confirm the new API is missing.
- [ ] Implement `GameMediaAudio` with `unlock`, `setPreferences`, `playCollision`, `playVictory`, and `resetVictory`. Catch rejected `play()` promises so media failure cannot escape into UI code.
- [ ] Update `AudioPreferences` to `{ sfxMuted, musicMuted }`, accept legacy `{ ambienceMuted }` storage, and route only `SHARPENER_SHARPENER` through the MP3 controller while preserving the remaining synthesized cues.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Shared sound controls and first-interaction unlock

**Files:**
- Create: `apps/web/features/match/use-audio-preferences.ts`
- Create: `apps/web/features/match/audio-menu.tsx`
- Create: `apps/web/features/match/audio-menu.module.css`
- Modify: `apps/web/features/match/game-experience.tsx`
- Modify: `apps/web/features/match/sharpener-selector.tsx`
- Modify: `apps/web/features/match/use-game-audio.ts`
- Modify: `apps/web/features/match/match-canvas.tsx`

- [ ] Move preference state and persistence into `useAudioPreferences`; register one document-level pointer/keyboard unlock listener and expose independent toggle callbacks.
- [ ] Build an accessible fixed top-right speaker menu with icon, `aria-expanded`, Music, and SFX buttons using the established classroom-paper aesthetic.
- [ ] Mount the menu once in `GameExperience`, remove the old bottom Room/SFX controls, and keep selector click sounds routed through the already-configured singleton director.
- [ ] Update `useGameAudio` to adapt only physics events, slide motion, and match-over phase transitions.

### Task 3: Winner summary and replay

**Files:**
- Create: `apps/web/features/match/match-summary.ts`
- Create: `apps/web/features/match/match-summary.test.ts`
- Modify: `apps/web/features/match/match-canvas.tsx`
- Modify: `apps/web/features/match/match-ui.module.css`

- [ ] Write a failing pure test proving a final snapshot produces winner label, `3–1` final score, round count, and total turns.
- [ ] Run `npx vitest run apps/web/features/match/match-summary.test.ts` and confirm the helper is missing.
- [ ] Implement the projection helper and a focused nostalgic winner overlay with four statistics and Play Again wired to the existing reset path.
- [ ] Ensure replay stops victory media immediately before resetting the worker.
- [ ] Re-run the focused test and confirm it passes.

### Task 4: Browser regression and documentation

**Files:**
- Modify: `e2e/local-match.spec.ts`
- Modify: `Architecture.md`
- Modify: `memory/memory.md`

- [ ] Add a Playwright journey that opens the top-right sound menu on the selector, toggles Music and SFX independently, enters a match, and verifies the same controls and persisted states remain available.
- [ ] Run `npm run test:e2e` serially and confirm every browser journey passes.
- [ ] Update the architecture ownership map, audio event table, persistence keys, and verified checkpoint. Add a compact milestone to project memory.
- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`, and `git diff --check` serially where `.next` or port 3000 is shared.

No commit or push is included because repository mutation beyond source edits was not authorized.
