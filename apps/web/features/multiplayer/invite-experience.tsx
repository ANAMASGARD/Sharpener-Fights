"use client";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import type { InvitePreview, SharpenerCosmeticId } from "@sharpener/protocol";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { COSMETICS, readStoredCosmetic, writeStoredCosmetic } from "../match/cosmetics";
import { multiplayerApi, operationId } from "./multiplayer-api";
import styles from "./multiplayer.module.css";

export function InviteExperience({ code }: { code: string }) {
  const router = useRouter();
  const claimOperationRef = useRef(operationId("claim"));
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [cosmeticId, setCosmeticId] = useState<SharpenerCosmeticId>(() => typeof window === "undefined" ? "ember-red" : readStoredCosmetic(window.localStorage));
  useEffect(() => {
    void multiplayerApi.previewInvite(code).then(setInvite).catch((reason) => setError(reason instanceof Error ? reason.message : "Invitation unavailable."));
  }, [code]);
  async function join() {
    if (!invite) return;
    try {
      setJoining(true); setError(null);
      const admission = await multiplayerApi.claimInvite(code, cosmeticId, claimOperationRef.current);
      window.history.replaceState(null, "", `/play/${admission.roomId}`);
      router.replace(`/play/${admission.roomId}`);
    } catch (reason) { setJoining(false); setError(reason instanceof Error ? reason.message : "Could not join this desk."); }
  }
  return <main className={styles["paper-screen"]}><section className={styles["invite-card"]}>
    <span className={styles.kicker}>Private desk invitation</span>
    <h1>{invite ? `${invite.hostDisplayName} challenged you` : "Opening the envelope…"}</h1>
    <p>Bring your selected sharpener. Weight, power, and physics remain identical for both fighters.</p>
    <SignedOut><SignInButton mode="modal"><button className={styles.primary}>Sign in to accept</button></SignInButton></SignedOut>
    <SignedIn><div className={styles["invite-swatches"]} aria-label="Choose sharpener color">{COSMETICS.map((cosmetic) => <button key={cosmetic.id} aria-pressed={cosmeticId === cosmetic.id} style={{ background: cosmetic.body }} onClick={() => { setCosmeticId(cosmetic.id); writeStoredCosmetic(window.localStorage, cosmetic.id); }}><span className="sr-only">{cosmetic.name}</span></button>)}</div><button className={styles.primary} disabled={!invite || joining || invite.state !== "AVAILABLE"} onClick={() => void join()}>{joining ? "Taking your seat…" : "Accept challenge"}</button></SignedIn>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section></main>;
}
