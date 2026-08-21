# Selection and Attack Audio Design

## Goal

Use the supplied `Selection-click.mp3` when the player changes sharpener color and `Sharpener-click.mp3` for each valid attack, without duplicate playback, autoplay, or component-owned audio elements.

## Ownership and behavior

`GameMediaAudio` remains the single owner of MP3 media elements. On the first legal user interaction, `unlock()` creates and preloads the two new effects alongside existing music/collision/victory media; preloading does not call `play()`. Both effects respect the persisted SFX mute preference, rewind to `currentTime = 0`, and ignore rejected playback promises so audio cannot break selection or gameplay.

The selector calls `gameAudio.playSelectionClick()` only when the clicked cosmetic ID differs from the selected ID. Re-clicking the current color is silent. Lock In keeps its existing synthesized UI confirmation.

`SHOT_ACCEPTED` remains the current local/bot authority seam and calls the shared `playAttack(shotId)`. The controller remembers recent shot IDs, so a future online local-prediction path can call the same method immediately and the later authoritative event will not replay it. Remote authoritative events still play because their shot IDs have not been seen. Cancelled/sub-threshold drags have no accepted event and remain silent. The existing synthesized flick is removed rather than layered with the MP3.

## Current product boundary

No online server, remote player, local network prediction, bot, or rejection-reconciliation path exists in this checkpoint. This pass provides a bounded deduplication API for those future callers without claiming or implementing networking.

## Verification

- Unit tests verify exact asset paths, preload-without-autoplay, replay from zero, independent SFX mute, and per-shot-ID deduplication.
- Browser coverage verifies silence on re-select, one selection sound on color change, one attack sound after a valid release, and HTTP availability of both files.
- Existing background, collision, victory, timeout, reset, gameplay, and no-WebGL journeys must remain green.
