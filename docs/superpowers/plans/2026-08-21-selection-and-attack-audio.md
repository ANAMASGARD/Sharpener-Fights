# Selection and Attack Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add supplied color-selection and accepted-attack MP3 effects through the shared audio controller with shot-ID deduplication.

**Architecture:** `GameMediaAudio` owns and preloads all media elements. `GameAudioDirector` maps selector changes and accepted-shot events into that controller; future predicted shots call the same deduplicated attack method. Components never construct audio elements.

**Tech Stack:** TypeScript, React, HTMLMediaElement, Vitest, Playwright, Next.js static assets.

---

### Task 1: Lock the media-controller contract

**Files:**
- Modify: `apps/web/features/match/media-audio.test.ts`
- Modify: `apps/web/features/match/media-audio.ts`

- [x] Add a failing test that expects `/audio/Selection-click.mp3` and `/audio/Sharpener-click.mp3` to be created with `preload = "auto"` but not autoplayed during `unlock()`.
- [x] Add a failing test that selection rewinds and plays, attack rewinds and plays once per unique `shotId`, and both remain silent while SFX is muted.
- [x] Run `npx vitest run apps/web/features/match/media-audio.test.ts` and confirm the missing methods/assets fail.
- [x] Implement `playSelection()` and deduplicated `playAttack(shotId)` in `GameMediaAudio`, retaining only a bounded recent-ID set.
- [x] Rerun the focused test and require green.

### Task 2: Serve and wire the supplied effects

**Files:**
- Copy: `public/audio/Selection-click.mp3` to `apps/web/public/audio/Selection-click.mp3`
- Copy: `public/audio/Sharpener-click.mp3` to `apps/web/public/audio/Sharpener-click.mp3`
- Modify: `apps/web/features/match/audio.ts`
- Modify: `apps/web/features/match/audio.test.ts`
- Modify: `apps/web/features/match/sharpener-selector.tsx`

- [x] Copy the exact supplied binary assets into the nested Next.js public directory without modifying the originals.
- [x] Include `shotId` in the accepted-shot audio cue and route flick cues to `GameMediaAudio.playAttack(shotId)` instead of synthesized noise/tone.
- [x] Expose `playPredictedAttack(shotId)` and `playSelectionClick()` on the shared director for current UI and future prediction callers.
- [x] Change swatch handling so the selection asset plays only when `option.id !== selected`; replace the old synthetic Lock In click with the supplied effect.
- [x] Run focused unit tests, typecheck, and lint.

### Task 3: Verify the browser journey and document ownership

**Files:**
- Modify: `e2e/local-match.spec.ts`
- Modify: `Architecture.md`
- Modify: `memory/memory.md`

- [x] Extend the media-playback browser harness to prove re-select is silent, color change plays once, Lock In plays once, and a valid accepted shot plays the attack asset once.
- [x] Request every new `/audio/*.mp3` URL and require successful responses.
- [x] Update architecture and compact memory with the controller ownership, authoritative current trigger, and future predicted-shot deduplication seam.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, the focused audio browser journey, and `git diff --check`.
- [ ] Rerun the complete browser suite in an unrestricted local runner before release; this environment's full serial run did not complete its report after its first six green journeys, while the focused audio journey passed.
- [ ] Do not commit or push without separate authorization.
