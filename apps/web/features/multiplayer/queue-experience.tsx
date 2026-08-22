"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { readStoredCosmetic } from "../match/cosmetics";
import { multiplayerApi, operationId } from "./multiplayer-api";
import styles from "./multiplayer.module.css";

const BACKOFF_MS = [500, 1_000, 2_000, 3_000] as const;

export function QueueExperience() {
  const router = useRouter();
  const ticketRef = useRef(operationId("ticket"));
  const [seconds, setSeconds] = useState(0);
  const [status, setStatus] = useState("Taking your place in line…");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1_000);
    let disposed = false;
    let timeout: number | undefined;
    let attempt = 0;
    const ticketId = ticketRef.current;
    const handle = (result: Awaited<ReturnType<typeof multiplayerApi.joinQueue>>) => {
      if (disposed) return;
      if (result.status === "MATCHED") {
        setStatus("Opponent found — opening the desk…");
        router.replace(`/play/${result.roomId}`);
        return;
      }
      setStatus(`You are number ${result.position} in line`);
      timeout = window.setTimeout(poll, BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)]);
    };
    const retry = (reason: unknown) => {
      if (disposed) return;
      setError(reason instanceof Error ? reason.message : "The queue is temporarily unavailable.");
      timeout = window.setTimeout(poll, BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)]);
    };
    const poll = () => void multiplayerApi.queueStatus(ticketId).then((result) => {
      setError(null);
      handle(result);
    }).catch(retry);
    void multiplayerApi.joinQueue(ticketId, readStoredCosmetic(window.localStorage)).then(handle).catch(retry);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      if (timeout) window.clearTimeout(timeout);
      void multiplayerApi.cancelQueue(ticketId);
    };
  }, [router]);
  return <main className={styles["paper-screen"]}><section className={styles["queue-card"]}>
    <span className={styles.kicker}>Instant match</span><h1>Looking across the schoolyard</h1>
    <div className={styles["queue-pulse"]} aria-hidden><i /><i /><i /></div>
    <strong>{status}</strong><p>{seconds}s elapsed · compatible players are paired first-in, first-out</p>
    <button onClick={() => router.push("/modes")}>Leave queue</button>{error && <p role="alert" className={styles.error}>{error}</p>}
  </section></main>;
}
