"use client";

import { useAuth } from "@clerk/nextjs";
import { PROTOCOL_VERSION } from "@sharpener/protocol";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { readStoredCosmetic } from "../match/cosmetics";
import { createRealtimeClient, rememberRoom } from "./realtime-session";
import styles from "./multiplayer.module.css";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "development";

export function FriendRoomLauncher() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    try {
      setBusy(true);
      setError(null);
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const room = await createRealtimeClient(token).create("sharpener_match", {
        protocolVersion: PROTOCOL_VERSION,
        buildId: BUILD_ID,
        mode: "FRIEND",
        cosmeticId: readStoredCosmetic(window.localStorage),
      });
      rememberRoom(room);
      router.replace(`/play/${room.roomId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a friend match.");
      setBusy(false);
    }
  }

  return (
    <main className={styles["paper-screen"]}>
      <section className={styles["queue-card"]}>
        <span>Private desk</span>
        <h1>{error ? "Desk unavailable" : "Invite a friend"}</h1>
        <p role={error ? "alert" : undefined}>{error ?? "Open a private desk, then copy its one-use invitation."}</p>
        <button className={styles.primary} disabled={busy} onClick={() => void createRoom()}>
          {busy ? "Opening desk…" : error ? "Try again" : "Open private desk"}
        </button>
        <button className={styles.local} disabled={busy} onClick={() => router.replace("/modes")}>Back to modes</button>
      </section>
    </main>
  );
}
