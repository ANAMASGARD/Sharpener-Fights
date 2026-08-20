import type { GameSnapshot } from "@sharpener/protocol";
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
      className={`fallback-fighter fallback-fighter-${player}`}
      style={{
        "--fighter-body": cosmetic.body,
        "--fighter-edge": cosmetic.edge,
        "--fighter-highlight": cosmetic.highlight,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="fallback-fighter-hole" />
      <span className="fallback-fighter-blade"><i /></span>
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
    <div className="classroom-fallback" aria-hidden="true">
      <div className="fallback-wall">
        <div className="fallback-blackboard">
          <div className="fallback-board-scratches" />
          <div className="fallback-board-title">Sharpener Fights</div>
          <div className="fallback-board-meta">
            Round {snapshot?.roundId ?? 1} · Best of five
          </div>
          <div className="fallback-score-row">
            <span>Orange</span><b>{scores[0]}</b>
            <i />
            <span>Blue</span><b>{scores[1]}</b>
          </div>
          <div className="fallback-chalk" />
        </div>
        <div className="fallback-chair">
          <span />
        </div>
      </div>
      <div className="fallback-tile-floor" />
      <div className="fallback-desk-legs">
        <i /><i /><i /><i />
      </div>
      <div className="fallback-desk">
        <div className="fallback-wood-grain" />
        <span className="fallback-scratch fallback-scratch-one" />
        <span className="fallback-scratch fallback-scratch-two" />
        <span className="fallback-carving">A + R</span>
        <StaticSharpener cosmeticId={cosmetics[1]} player={1} />
        <StaticSharpener cosmeticId={cosmetics[0]} player={0} />
      </div>
    </div>
  );
}
