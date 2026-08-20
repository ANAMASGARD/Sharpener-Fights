# Game Audio and Victory Design

## Goal

Use the four supplied MP3 files as reliable game audio, expose separate music and sound-effect controls from a top-right speaker menu, and replace the basic match-over card with a polished winner summary and replay action.

## Approved behavior

- `/audio/PlayGround-BG.mp3` starts after the first pointer or keyboard interaction, plays at 50% volume, loops continuously, and survives the selector-to-match transition.
- `/audio/sharpener-collision.mp3` replaces the synthesized metal click for every `SHARPENER_SHARPENER` contact. Existing flick, wood, floor, falling, and slide cues remain.
- When the phase first becomes `MATCH_OVER`, `/audio/School-Bell.mp3` and `/audio/Winner-Effect.mp3` start together once. The winner effect stops after seven seconds; the bell may finish naturally.
- Reset/replay stops outstanding victory audio and allows the next match to trigger it again.
- A persistent top-right speaker button opens separate Music and SFX controls. Both preferences survive reloads. Legacy `ambienceMuted` storage is migrated to `musicMuted`.
- The winner overlay shows winner name/color, final score, rounds played, total turns, and a prominent Play Again button.

## Architecture

`GameMediaAudio` owns long-lived HTML audio elements and timer cleanup. The existing `GameAudioDirector` remains the public sound facade and retains Web Audio synthesis for lightweight physical cues. `GameExperience` owns audio preferences and the menu above both child screens, so changing screens cannot recreate or restart music.

`useGameAudio` remains the adapter from physics events/snapshots to sound. It detects the transition into `MATCH_OVER` and asks the director to play victory audio once. A pure match-summary helper converts the final snapshot into display statistics.

## Failure behavior

Media `play()` promise rejection, unavailable audio APIs, or missing files must not interrupt the game. Audible autoplay is not attempted before a user gesture. Muting SFX immediately stops active collision/victory media; muting music pauses only background music.

## Test seams

1. `GameMediaAudio` with injected audio elements and scheduler: loop/volume, independent mutes, collision playback, simultaneous victory playback, seven-second cutoff, and reset.
2. Pure winner-summary projection from `GameSnapshot`.
3. Playwright-visible sound menu on selector and match screens, independent persisted controls, and existing gameplay journeys.

## Scope

No changes to Rapier physics, commands, protocol types, match rules, camera, or rendering quality. No audio upload pipeline or server persistence is introduced.
