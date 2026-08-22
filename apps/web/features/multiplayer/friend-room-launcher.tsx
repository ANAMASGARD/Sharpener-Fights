"use client";

import type { FriendRoomCreateResponse } from "@sharpener/protocol";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { readStoredCosmetic } from "../match/cosmetics";
import { multiplayerApi, operationId } from "./multiplayer-api";
import styles from "./multiplayer.module.css";

export function FriendRoomLauncher() {
  const router = useRouter();
  const requestIdRef = useRef(operationId("friend"));
  const [invite, setInvite] = useState<FriendRoomCreateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    try {
      setBusy(true);
      setError(null);
      setInvite(await multiplayerApi.createFriendRoom(
        readStoredCosmetic(window.localStorage),
        requestIdRef.current,
      ));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a friend match.");
    } finally { setBusy(false); }
  }

  async function copyInvite() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  if (invite) {
    const text = encodeURIComponent("Fight me in Sharpener Fights!");
    const url = encodeURIComponent(invite.inviteUrl);
    return <main className={styles["paper-screen"]}><section className={styles["queue-card"]}>
      <span className={styles.kicker}>Private desk ready</span>
      <h1>Pass the challenge</h1>
      <p>This one-use link expires in 15 minutes. Your friend signs in, chooses a color, and joins your desk.</p>
      <div className={styles["invite-link"]}><code>{invite.inviteUrl}</code><button onClick={() => void copyInvite()}>{copied ? "Copied!" : "Copy link"}</button></div>
      <div className={styles["share-grid"]} aria-label="Share invitation">
        {typeof navigator !== "undefined" && "share" in navigator && <button onClick={() => void navigator.share({ title: "Sharpener Fights", text: "Fight me in Sharpener Fights!", url: invite.inviteUrl })}>Share</button>}
        <a href={`https://wa.me/?text=${text}%20${url}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <a href={`https://t.me/share/url?url=${url}&text=${text}`} target="_blank" rel="noreferrer">Telegram</a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${url}`} target="_blank" rel="noreferrer">Facebook</a>
        <a href={`https://twitter.com/intent/tweet?text=${text}&url=${url}`} target="_blank" rel="noreferrer">X</a>
        <a href={`mailto:?subject=${text}&body=${text}%0A${url}`}>Email</a>
      </div>
      <button className={styles.primary} onClick={() => router.push(`/play/${invite.roomId}`)}>Wait at the desk</button>
      <button className={styles.local} onClick={() => router.replace("/modes")}>Back to modes</button>
    </section></main>;
  }

  return <main className={styles["paper-screen"]}><section className={styles["queue-card"]}>
    <span>Private desk</span>
    <h1>{error ? "Desk unavailable" : "Invite a friend"}</h1>
    <p role={error ? "alert" : undefined}>{error ?? "Open a private desk, then share its secure one-use invitation."}</p>
    <button className={styles.primary} disabled={busy} onClick={() => void createRoom()}>{busy ? "Opening desk…" : error ? "Try again" : "Open private desk"}</button>
    <button className={styles.local} disabled={busy} onClick={() => router.replace("/modes")}>Back to modes</button>
  </section></main>;
}
