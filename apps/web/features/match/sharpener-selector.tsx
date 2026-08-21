"use client";

import { useState } from "react";
import styles from "./sharpener-selector.module.css";
import type { SharpenerCosmeticId } from "@sharpener/protocol";
import {
  COSMETICS,
  chooseOpponentCosmetic,
  getCosmetic,
  readStoredCosmetic,
  writeStoredCosmetic,
} from "./cosmetics";
import { gameAudio } from "./audio";
import { SharpenerPreview } from "./sharpener-preview";

export type MatchCosmetics = readonly [
  SharpenerCosmeticId,
  SharpenerCosmeticId,
];

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
    gameAudio.unlock();
    gameAudio.playLockIn();
    writeStoredCosmetic(window.localStorage, selected);
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const opponent = chooseOpponentCosmetic(selected, random);
    setClosing(true);
    window.setTimeout(() => onStart([selected, opponent]), 520);
  }

  return (
    <main className={styles["selection-screen"]}>
      <div className={styles["selection-grain"]} aria-hidden="true" />
      <section className={`${styles["sharpener-case"]}${closing ? ` ${styles["case-closing"]}` : ""}`}>
        <header className={styles["case-lid"]}>
          <span className={styles["case-kicker"]}>Schoolyard series</span>
          <h1>Sharpener<br />Fights</h1>
          <div className={styles["case-mark"]} aria-hidden="true">
            <span />
            <b>×</b>
            <span />
          </div>
        </header>

        <div className={styles["case-tray"]}>
          <div
            className={styles["preview-well"]}
            data-part="sharpener-preview"
            aria-label={`${cosmetic.name} preview`}
          >
            <SharpenerPreview cosmetic={selected} />
          </div>

          <div className={styles["swatch-grid"]} role="radiogroup" aria-label="Sharpener color">
            {COSMETICS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected === option.id}
                className={styles["swatch-button"]}
                onClick={() => {
                  gameAudio.unlock();
                  if (option.id === selected) return;
                  gameAudio.playSelectionClick();
                  setSelected(option.id);
                }}
              >
                <span
                  className={styles["swatch-color"]}
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

      <section className={styles["selection-ticket"]}>
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
