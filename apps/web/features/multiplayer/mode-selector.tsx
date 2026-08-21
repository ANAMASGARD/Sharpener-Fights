"use client";

import { useAuth, UserButton } from "@clerk/nextjs";
import { PROTOCOL_VERSION } from "@sharpener/protocol";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { readStoredCosmetic } from "../match/cosmetics";
import { createRealtimeClient, rememberRoom } from "./realtime-session";
import styles from "./multiplayer.module.css";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "development";

export function ModeSelector() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function createFriendRoom() {
    try {
      setBusy("friend"); setError(null);
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const room = await createRealtimeClient(token).create("sharpener_match", {
        protocolVersion: PROTOCOL_VERSION, buildId: BUILD_ID, mode: "FRIEND",
        cosmeticId: readStoredCosmetic(window.localStorage),
      });
      rememberRoom(room); router.push(`/play/${room.roomId}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create a friend match."); setBusy(null); }
  }
  return <main className={styles["paper-screen"]}>
    <header className={styles["mode-header"]}><span>Multiplayer</span><UserButton /></header>
    <section className={styles["mode-grid"]}>
      <article><b aria-hidden>↗</b><h1>Play with a friend</h1><p>Open a private desk and share a one-use invitation.</p><button className={styles.primary} disabled={Boolean(busy)} onClick={() => void createFriendRoom()}>{busy === "friend" ? "Opening desk…" : "Send a link"}</button></article>
      <article><b aria-hidden>◎</b><h1>Instant match</h1><p>Join the Singapore queue and meet the next waiting fighter.</p><button className={styles.primary} disabled={Boolean(busy)} onClick={() => router.push("/queue")}>Find opponent</button></article>
    </section>
    <button className={styles.local} onClick={() => router.push("/play/local")}>Play local on this device</button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </main>;
}
