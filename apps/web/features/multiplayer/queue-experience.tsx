"use client";

import { useAuth } from "@clerk/nextjs";
import { PROTOCOL_VERSION, ServerRealtimeMessageSchema } from "@sharpener/protocol";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readStoredCosmetic } from "../match/cosmetics";
import { createRealtimeClient, rememberRoom } from "./realtime-session";
import styles from "./multiplayer.module.css";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "development";

export function QueueExperience() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("Taking your place in line…");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1_000);
    let disposed = false;
    let leave: (() => void) | undefined;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("Please sign in again.");
        const client = createRealtimeClient(token);
        const cosmeticId = readStoredCosmetic(window.localStorage);
        const queue = await client.joinOrCreate("instant_queue", { protocolVersion: PROTOCOL_VERSION, buildId: BUILD_ID, cosmeticId });
        leave = () => queue.leave();
        queue.onMessage("server_message", async (raw: unknown) => {
          const parsed = ServerRealtimeMessageSchema.safeParse(raw);
          if (!parsed.success) return;
          if (parsed.data.type === "QUEUE_STATUS") setStatus(`You are number ${parsed.data.position} in line`);
          if (parsed.data.type === "ERROR") setError(parsed.data.message);
          if (parsed.data.type === "MATCH_FOUND") {
            setStatus("Opponent found — opening the desk…");
            const room = await client.joinById(parsed.data.roomId, { protocolVersion: PROTOCOL_VERSION, buildId: BUILD_ID, mode: "INSTANT", cosmeticId });
            if (disposed) return room.leave();
            rememberRoom(room); queue.leave(); router.push(`/play/${room.roomId}`);
          }
        });
      } catch (reason) { setError(reason instanceof Error ? reason.message : "The queue is unavailable."); }
    })();
    return () => { disposed = true; window.clearInterval(timer); leave?.(); };
  }, [getToken, router]);
  return <main className={styles["paper-screen"]}><section className={styles["queue-card"]}>
    <span className={styles.kicker}>Instant match</span><h1>Looking across the schoolyard</h1>
    <div className={styles["queue-pulse"]} aria-hidden><i /><i /><i /></div>
    <strong>{status}</strong><p>{seconds}s elapsed · strict first-in, first-out queue</p>
    <button onClick={() => router.push("/modes")}>Leave queue</button>{error && <p role="alert" className={styles.error}>{error}</p>}
  </section></main>;
}
