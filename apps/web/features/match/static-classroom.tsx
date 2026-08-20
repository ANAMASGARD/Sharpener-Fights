import type { GameSnapshot } from "@sharpener/protocol";
import styles from "./static-classroom.module.css";
import { getCosmetic } from "./cosmetics";
import type { MatchCosmetics } from "./sharpener-selector";

function StaticSharpener({
  cosmeticId,
  player,
}: {
  cosmeticId: MatchCosmetics[number];
  player: 0 | 1;
}) {
  const cosmetic = getCosmetic(cosmeticId);
  return (
    <div
      className={`${styles["fallback-fighter"]} ${styles[`fallback-fighter-${player}`]}`}
      style={{
        "--fighter-body": cosmetic.body,
        "--fighter-edge": cosmetic.edge,
        "--fighter-highlight": cosmetic.highlight,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className={styles["fallback-fighter-hole"]} />
      <span className={styles["fallback-fighter-blade"]}><i /></span>
    </div>
  );
}

export function StaticClassroom({
  snapshot,
  cosmetics,
}: {
  snapshot: GameSnapshot | null;
  cosmetics: MatchCosmetics;
}) {
  const scores = snapshot?.scores ?? [0, 0];
  return (
    <div
      className={styles["classroom-fallback"]}
      data-layer="static-classroom"
      aria-hidden="true"
    >
      <div className={styles["fallback-wall"]}>
      <div className={styles["fallback-blackboard"]} data-part="classroom-blackboard">
          <div className={styles["fallback-board-scratches"]} />
          <div className={styles["fallback-board-title"]}>Sharpener Fights</div>
          <div className={styles["fallback-board-meta"]}>
            Round {snapshot?.roundId ?? 1} · Best of five
          </div>
          <div className={styles["fallback-score-row"]}>
            <span>Orange</span><b>{scores[0]}</b>
            <i />
            <span>Blue</span><b>{scores[1]}</b>
          </div>
          <div className={styles["fallback-chalk"]} />
        </div>
        <div className={styles["fallback-chair"]}>
          <span />
        </div>
      </div>
      <div className={styles["fallback-tile-floor"]} data-part="classroom-floor" />
      <div className={styles["fallback-desk-legs"]}>
        <i /><i /><i /><i />
      </div>
      <div className={styles["fallback-desk"]} data-part="classroom-desk">
        <div className={styles["fallback-wood-grain"]} />
        <span className={`${styles["fallback-scratch"]} ${styles["fallback-scratch-one"]}`} />
        <span className={`${styles["fallback-scratch"]} ${styles["fallback-scratch-two"]}`} />
        <span className={styles["fallback-carving"]}>A + R</span>
        <StaticSharpener cosmeticId={cosmetics[1]} player={1} />
        <StaticSharpener cosmeticId={cosmetics[0]} player={0} />
      </div>
    </div>
  );
}
