"use client";

import { useRouter } from "next/navigation";
import { usePwaRuntime } from "../pwa/pwa-context";
import styles from "./multiplayer.module.css";

export function ModeSelector() {
  const router = useRouter();
  const { online, checkingConnectivity } = usePwaRuntime();
  const onlineUnavailable = checkingConnectivity || !online;
  return <main className={styles["paper-screen"]}>
    <header className={styles["mode-header"]}><span>Choose your desk</span></header>
    <section className={styles["mode-grid"]}>
      <article><b aria-hidden>↗</b><h1>Play with a friend</h1><p>Sign in, open a private desk, and share a one-use invitation.</p><button className={styles.primary} disabled={onlineUnavailable} onClick={() => router.push("/friend")}>{checkingConnectivity ? "Checking Wi-Fi…" : online ? "Send a link" : "Offline"}</button></article>
      <article><b aria-hidden>◎</b><h1>Instant match</h1><p>Sign in and meet the next waiting fighter in the online queue.</p><button className={styles.primary} disabled={onlineUnavailable} onClick={() => router.push("/queue")}>{checkingConnectivity ? "Checking Wi-Fi…" : online ? "Find opponent" : "Offline"}</button></article>
    </section>
    <button className={styles.local} onClick={() => router.push("/play/local")}>Play local on this device</button>
    {!checkingConnectivity && !online && <p role="status" className={styles.error}>You are offline. Local Play is still ready.</p>}
  </main>;
}
