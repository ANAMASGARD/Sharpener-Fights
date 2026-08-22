"use client";

import Image from "next/image";
import type { InstallSurface } from "./pwa-policy";
import styles from "./pwa.module.css";

export function InstallTicket({
  surface,
  onInstall,
  onDismiss,
}: {
  surface: Exclude<InstallSurface, "installed" | "unavailable">;
  onInstall: () => void;
  onDismiss: () => void;
}) {
  const manual = surface === "ios-manual";

  return (
    <section
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
      data-testid="install-ticket"
    >
      <div className={styles.ticket}>
        <div className={styles["logo-well"]} aria-hidden="true">
          <Image
            src="/brand/sharpener-fights-logo.png"
            alt=""
            width={640}
            height={640}
            sizes="128px"
            priority={false}
            unoptimized
          />
        </div>
        <div className={styles.copy}>
          <span className={styles.kicker}>Take the desk with you</span>
          <h2 id="install-title">Install Sharpener Fights</h2>
          {manual ? (
            <ol className={styles.steps}>
              <li>Open the browser&apos;s <strong>Share</strong> menu.</li>
              <li>Choose <strong>Add to Home Screen</strong>.</li>
              <li>Turn on <strong>Open as Web App</strong>, then tap Add.</li>
            </ol>
          ) : (
            <p>Launch faster and keep Local Play ready even when the classroom Wi-Fi disappears.</p>
          )}
          <div className={styles.actions}>
            {!manual && <button type="button" onClick={onInstall}>Install</button>}
            <button type="button" className={styles.secondary} onClick={onDismiss}>
              {manual ? "Got it" : "Later"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function UpdateTicket({ onUpdate, onDismiss }: { onUpdate: () => void; onDismiss: () => void }) {
  return (
    <section className={styles.update} role="status" data-testid="update-ticket">
      <div>
        <span>Fresh chalk on the board</span>
        <strong>An update is ready.</strong>
      </div>
      <button type="button" onClick={onUpdate}>Update now</button>
      <button type="button" className={styles.secondary} onClick={onDismiss}>Later</button>
    </section>
  );
}
