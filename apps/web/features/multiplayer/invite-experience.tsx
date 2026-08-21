"use client";

import { SignInButton, SignedIn, SignedOut, useAuth } from "@clerk/nextjs";
import { PROTOCOL_VERSION, InviteMetadataSchema, type InviteMetadata } from "@sharpener/protocol";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COSMETICS, readStoredCosmetic, writeStoredCosmetic } from "../match/cosmetics";
import { createRealtimeClient, rememberRoom } from "./realtime-session";
import styles from "./multiplayer.module.css";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "development";

export function InviteExperience({ code }: { code: string }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [cosmeticId, setCosmeticId] = useState(() => typeof window === "undefined" ? "ember-red" as const : readStoredCosmetic(window.localStorage));
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_REALTIME_HTTP_URL ?? "http://localhost:2567";
    void fetch(`${base}/invites/${encodeURIComponent(code)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("This invitation is unavailable.");
        return InviteMetadataSchema.parse(await response.json());
      })
      .then(setInvite).catch((reason) => setError(reason instanceof Error ? reason.message : "Invitation unavailable."));
  }, [code]);
  async function join() {
    if (!invite) return;
    try {
      setJoining(true); setError(null);
      const token = await getToken();
      if (!token) throw new Error("Please sign in again.");
      const room = await createRealtimeClient(token).joinById(invite.roomId, {
        protocolVersion: PROTOCOL_VERSION, buildId: BUILD_ID, mode: "FRIEND",
        cosmeticId, inviteCode: code,
      });
      rememberRoom(room); router.push(`/play/${room.roomId}`);
    } catch (reason) { setJoining(false); setError(reason instanceof Error ? reason.message : "Could not join this desk."); }
  }
  return <main className={styles["paper-screen"]}><section className={styles["invite-card"]}>
    <span className={styles.kicker}>Private desk invitation</span>
    <h1>{invite ? `${invite.hostDisplayName} challenged you` : "Opening the envelope…"}</h1>
    <p>Bring your selected sharpener. The physics, weight and power stay fair for both fighters.</p>
    <SignedOut><SignInButton mode="modal"><button className={styles.primary}>Sign in to accept</button></SignInButton></SignedOut>
    <SignedIn><div className={styles["invite-swatches"]} aria-label="Choose sharpener color">{COSMETICS.map((cosmetic) => <button key={cosmetic.id} aria-pressed={cosmeticId === cosmetic.id} style={{ background: cosmetic.body }} onClick={() => { setCosmeticId(cosmetic.id); writeStoredCosmetic(window.localStorage, cosmetic.id); }}><span className="sr-only">{cosmetic.name}</span></button>)}</div><button className={styles.primary} disabled={!invite || joining || invite.state !== "AVAILABLE"} onClick={() => void join()}>{joining ? "Taking your seat…" : "Accept challenge"}</button></SignedIn>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section></main>;
}
