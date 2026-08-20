"use client";

import { useState } from "react";
import type { SharpenerCosmeticId } from "@sharpener/protocol";
import {
  COSMETICS,
  chooseOpponentCosmetic,
  getCosmetic,
  readStoredCosmetic,
  writeStoredCosmetic,
} from "./cosmetics";
import { gameAudio, readAudioPreferences } from "./audio";

export type MatchCosmetics = readonly [
  SharpenerCosmeticId,
  SharpenerCosmeticId,
];

function SharpenerPreview({ cosmetic }: { cosmetic: SharpenerCosmeticId }) {
  const colors = getCosmetic(cosmetic);
  return (
    <div
      className="selector-sharpener-wrap"
      style={{
        "--sharpener-body": colors.body,
        "--sharpener-edge": colors.edge,
        "--sharpener-highlight": colors.highlight,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="selector-shadow" />
      <div className="selector-sharpener">
        <div className="selector-pencil-hole"><span /></div>
        <div className="selector-blade">
          <span className="selector-blade-edge" />
          <span className="selector-screw" />
        </div>
        <span className="selector-brand">SF</span>
      </div>
    </div>
  );
}

export function SharpenerSelector({
  onStart,
}: {
  onStart: (cosmetics: MatchCosmetics) => void;
}) {
  const [selected, setSelected] = useState<SharpenerCosmeticId>(() =>
    typeof window === "undefined"
      ? "ember-red"
      : readStoredCosmetic(window.localStorage),
  );
  const [closing, setClosing] = useState(false);
  const cosmetic = getCosmetic(selected);

  function lockIn() {
    if (closing) return;
    gameAudio.setPreferences(readAudioPreferences(window.localStorage));
    gameAudio.unlock();
    gameAudio.playUiClick();
    writeStoredCosmetic(window.localStorage, selected);
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const opponent = chooseOpponentCosmetic(selected, random);
    setClosing(true);
    window.setTimeout(() => onStart([selected, opponent]), 520);
  }

  return (
    <main className="selection-screen">
      <div className="selection-grain" aria-hidden="true" />
      <section className={`sharpener-case${closing ? " case-closing" : ""}`}>
        <header className="case-lid">
          <span className="case-kicker">Schoolyard series</span>
          <h1>Sharpener<br />Fights</h1>
          <div className="case-mark" aria-hidden="true">
            <span />
            <b>×</b>
            <span />
          </div>
        </header>

        <div className="case-tray">
          <div className="preview-well" aria-label={`${cosmetic.name} preview`}>
            <SharpenerPreview cosmetic={selected} />
          </div>

          <div className="swatch-grid" role="radiogroup" aria-label="Sharpener color">
            {COSMETICS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected === option.id}
                className="swatch-button"
                onClick={() => {
                  gameAudio.setPreferences(
                    readAudioPreferences(window.localStorage),
                  );
                  gameAudio.unlock();
                  gameAudio.playUiClick();
                  setSelected(option.id);
                }}
              >
                <span
                  className="swatch-color"
                  style={{
                    "--swatch": option.body,
                    "--swatch-edge": option.edge,
                  } as React.CSSProperties}
                />
                <span>{option.name}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="selection-ticket">
        <p>Choose your color</p>
        <strong>{cosmetic.name}</strong>
        <span>Same weight. Same power. Pure style.</span>
        <button type="button" onClick={lockIn} disabled={closing}>
          {closing ? "Closing the case…" : "Lock in"}
        </button>
      </section>
    </main>
  );
}
