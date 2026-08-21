"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { SharpenerCosmeticId } from "@sharpener/protocol";
import { getCosmetic } from "./cosmetics";
import { SHARPENER_APPEARANCE } from "./sharpener-appearance";
import styles from "./sharpener-selector.module.css";

type Rotation = Readonly<{ x: number; y: number }>;

type DragSession = Readonly<{
  pointerId: number;
  startX: number;
  startY: number;
  rotation: Rotation;
}>;

const INITIAL_ROTATION: Rotation = { x: -18, y: -38 };
const DRAG_SENSITIVITY = 0.62;
const KEYBOARD_STEP = 12;
const AUTO_RESUME_DELAY_MS = 900;

function wrapDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function SharpenerPreview({
  cosmetic,
}: {
  cosmetic: SharpenerCosmeticId;
}) {
  const colors = getCosmetic(cosmetic);
  const drag = useRef<DragSession | null>(null);
  const resumeTimer = useRef<number | null>(null);
  const [rotation, setRotation] = useState<Rotation>(INITIAL_ROTATION);
  const [dragging, setDragging] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);

  useEffect(() => () => {
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
  }, []);

  function pauseAutomaticRotation() {
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
    setAutoPaused(true);
  }

  function resumeAutomaticRotationSoon() {
    if (resumeTimer.current !== null) window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => {
      setAutoPaused(false);
      resumeTimer.current = null;
    }, AUTO_RESUME_DELAY_MS);
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rotation,
    };
    pauseAutomaticRotation();
    setDragging(true);
  }

  function updateDrag(event: PointerEvent<HTMLDivElement>) {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    event.preventDefault();
    setRotation({
      x: wrapDegrees(
        session.rotation.x - (event.clientY - session.startY) * DRAG_SENSITIVITY,
      ),
      y: wrapDegrees(
        session.rotation.y + (event.clientX - session.startX) * DRAG_SENSITIVITY,
      ),
    });
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
    setDragging(false);
    resumeAutomaticRotationSoon();
  }

  function rotateWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    const delta: { x?: number; y?: number } = {};
    if (event.key === "ArrowUp") delta.x = KEYBOARD_STEP;
    if (event.key === "ArrowDown") delta.x = -KEYBOARD_STEP;
    if (event.key === "ArrowLeft") delta.y = -KEYBOARD_STEP;
    if (event.key === "ArrowRight") delta.y = KEYBOARD_STEP;
    if (delta.x === undefined && delta.y === undefined) return;

    event.preventDefault();
    pauseAutomaticRotation();
    setRotation((current) => ({
      x: wrapDegrees(current.x + (delta.x ?? 0)),
      y: wrapDegrees(current.y + (delta.y ?? 0)),
    }));
    resumeAutomaticRotationSoon();
  }

  return (
    <div
      className={styles["selector-sharpener-wrap"]}
      data-auto-paused={autoPaused}
      data-dragging={dragging}
      data-part="interactive-sharpener-preview"
      style={{
        "--preview-rotate-x": `${rotation.x}deg`,
        "--preview-rotate-y": `${rotation.y}deg`,
        "--selector-body-aspect": SHARPENER_APPEARANCE.selector.aspectRatio,
        "--selector-depth": `${SHARPENER_APPEARANCE.selector.depthRem}rem`,
        "--sharpener-body": colors.body,
        "--sharpener-edge": colors.edge,
        "--sharpener-highlight": colors.highlight,
      } as CSSProperties}
      data-finish={cosmetic === "aluminium-silver" ? "aluminium" : "plastic"}
      role="group"
      aria-label={`${colors.name} 3D sharpener preview. Drag or use arrow keys to rotate.`}
      tabIndex={0}
      onKeyDown={rotateWithKeyboard}
      onPointerCancel={endDrag}
      onPointerDown={beginDrag}
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
    >
      <div className={styles["selector-shadow"]} aria-hidden="true" />
      <div className={styles["selector-sharpener-pose"]} aria-hidden="true">
        <div
          className={styles["selector-sharpener-spinner"]}
          data-axis="horizontal"
          data-part="rotating-sharpener"
        >
          <div className={styles["selector-sharpener-solid"]}>
            <div
              className={styles["selector-shell-core"]}
              data-part="enclosed-sharpener-body"
            >
              {[
                "top",
                "bottom",
                "front",
                "back",
                "left",
                "right",
              ].map((face) => (
                <span
                  key={face}
                  className={`${styles["selector-shell-core-face"]} ${styles[`selector-shell-core-${face}`]}`}
                  data-face={face}
                  data-part="enclosed-sharpener-face"
                />
              ))}
            </div>

            <div
              className={`${styles["selector-face"]} ${styles["selector-face-top"]}`}
              data-part="sharpener-top-face"
            >
              <span
                className={styles["selector-blade-channel"]}
                data-part="sharpener-blade-channel"
              />
              <div
                className={styles["selector-blade"]}
                data-part="sharpener-blade-plate"
              >
                <span className={styles["selector-blade-edge"]} />
                <span
                  className={styles["selector-screw"]}
                  data-part="sharpener-screw"
                />
              </div>
              <span className={styles["selector-brand"]}>SF · 01</span>
            </div>

            <div
              className={`${styles["selector-face"]} ${styles["selector-face-bottom"]}`}
              data-part="sharpener-bottom-face"
            >
              <span className={styles["selector-base-plate"]} />
              <span className={styles["selector-base-groove"]} />
              <span className={`${styles["selector-base-foot"]} ${styles["selector-base-foot-left"]}`} />
              <span className={`${styles["selector-base-foot"]} ${styles["selector-base-foot-right"]}`} />
            </div>

            <div
              className={styles["selector-molded-shoulder"]}
              data-part="sharpener-molded-shoulder"
            >
              <span />
            </div>

            <span data-part="sharpener-side" className={`${styles["selector-side"]} ${styles["selector-side-front"]}`}>
              <span className={styles["selector-grip-ribs"]} />
            </span>
            <span data-part="sharpener-side" className={`${styles["selector-side"]} ${styles["selector-side-back"]}`} />
            <span data-part="sharpener-side" className={`${styles["selector-side"]} ${styles["selector-side-left"]}`} />
            <span data-part="sharpener-side" className={`${styles["selector-side"]} ${styles["selector-side-right"]}`}>
              <span className={styles["selector-end-hole"]} data-part="sharpener-end-hole"><span /></span>
            </span>
          </div>
        </div>
      </div>
      <span className={styles["selector-drag-hint"]} aria-hidden="true">
        Drag to inspect
      </span>
    </div>
  );
}
