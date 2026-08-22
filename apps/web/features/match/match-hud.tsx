import { PHYSICS, TICKS_PER_SECOND } from "@sharpener/game-core";
import type { GameSnapshot, PlayerIndex } from "@sharpener/protocol";
import { resolveMatchCosmetics } from "./cosmetics";
import { createMatchSummary } from "./match-summary";
import { FullscreenButton } from "./fullscreen-button";
import type { MatchCosmetics } from "./sharpener-selector";
import styles from "./match-ui.module.css";

export function MatchHud({
  snapshot,
  aimPower,
  error,
  onChangeSharpener,
  onReset,
  localSeat,
  cosmetics,
}: {
  snapshot: GameSnapshot | null;
  aimPower: number;
  error: string | null;
  onChangeSharpener: () => void;
  onReset: () => void;
  localSeat: PlayerIndex | null;
  cosmetics: MatchCosmetics;
}) {
  const players = resolveMatchCosmetics(cosmetics);
  const fighterName = (player: PlayerIndex) => players[player].name;
  const seconds = snapshot
    ? Math.ceil(snapshot.aimingTicksRemaining / TICKS_PER_SECOND)
    : PHYSICS.aimingSeconds;
  const roundMessage = snapshot
    ? snapshot.roundWinner === null
      ? "Round draw"
      : `${fighterName(snapshot.roundWinner)} wins the round`
    : "";
  const matchSummary = snapshot ? createMatchSummary(snapshot, cosmetics) : null;

  return (
    <>
      {!snapshot && (
        <div className={styles["loading-card"]}>Opening the classroom…</div>
      )}
      {snapshot && (
        <>
          <p className="sr-only" aria-live="polite">
            Round {snapshot.roundId}. {players[0].name} {snapshot.scores[0]},{" "}
            {players[1].name} {snapshot.scores[1]}.
          </p>
          <div
            className={styles["turn-ticket"]}
            aria-live="polite"
            data-active-player={snapshot.activePlayer}
          >
            <span>
              {snapshot.phase === "AIMING"
                ? localSeat === null || snapshot.activePlayer === localSeat
                  ? "Your turn"
                  : "Opponent aims"
                : snapshot.phase.toLowerCase()}
            </span>
            <strong>
              {snapshot.phase === "AIMING"
                ? `${fighterName(snapshot.activePlayer)} · ${seconds}`
                : "Wait for the desk"}
            </strong>
          </div>
          <div
            className={styles["power-rail"]}
            data-part="power-meter"
            aria-label={`Shot power ${Math.round(aimPower * 100)}%`}
          >
            <span>Power</span>
            <div>
              <i style={{ height: `${aimPower * 100}%` }} />
            </div>
          </div>
          <div className={styles["match-controls"]}>
            <div>
              <button type="button" onClick={onChangeSharpener}>
                Change sharpener
              </button>
            </div>
            <div>
              <FullscreenButton />
              {snapshot.phase !== "MATCH_OVER" && (
                <button type="button" onClick={onReset}>
                  Reset
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {snapshot?.phase === "ROUND_OVER" && (
        <div className={styles["result-card"]} role="status">
          <span>Round {snapshot.roundId}</span>
          <strong>{roundMessage}</strong>
        </div>
      )}
      {matchSummary && (
        <div
          className={styles["winner-overlay"]}
          role="dialog"
          aria-modal="true"
          aria-labelledby="winner-title"
          data-part="winner-popup"
          data-winner={matchSummary.winnerName.toLowerCase()}
        >
          <div className={styles["winner-card"]}>
            <span className={styles["winner-kicker"]}>
              Match report · Best of five
            </span>
            <div className={styles["winner-stamp"]} aria-hidden="true">
              Winner
            </div>
            <h2 id="winner-title">{matchSummary.winnerName} wins!</h2>
            <p>The desk belongs to {matchSummary.winnerName}.</p>
            <dl className={styles["winner-stats"]}>
              <div>
                <dt>Final score</dt>
                <dd>{matchSummary.finalScore}</dd>
              </div>
              <div>
                <dt>Rounds</dt>
                <dd>{matchSummary.roundsPlayed}</dd>
              </div>
              <div>
                <dt>Turns</dt>
                <dd>{matchSummary.totalTurns}</dd>
              </div>
            </dl>
            <button type="button" onClick={onReset}>
              Play again
            </button>
          </div>
        </div>
      )}
      {error && <div className={styles["error-banner"]}>{error}</div>}
    </>
  );
}
