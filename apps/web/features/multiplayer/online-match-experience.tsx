"use client";

import { useRouter } from "next/navigation";
import type { EmoteId } from "@sharpener/protocol";
import { MatchView } from "../match/match-view";
import { useOnlineMatch } from "./use-online-match";
import styles from "./multiplayer.module.css";

export function OnlineMatchExperience({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { feed, lobby, cosmetics, inviteUrl, activeEmote, ready, emote, leave } = useOnlineMatch(roomId);
  if (!lobby || lobby.status === "WAITING" || lobby.status === "COUNTDOWN" || lobby.status === "PAUSED_RECONNECT" || lobby.status === "CLOSED") {
    const me = lobby?.players.find((player) => player.seat === feed.localSeat);
    return <main className={styles["paper-screen"]}><section className={styles["lobby-card"]}>
      <span className={styles.kicker}>{lobby?.mode === "FRIEND" ? "Friend match" : "Instant match"}</span>
      <h1>{lobby?.players.length === 2 ? "Both fighters are here" : "Waiting at the desk"}</h1>
      {lobby?.status === "PAUSED_RECONNECT" && <p>Connection lost. This seat is reserved for 30 seconds.</p>}
      {lobby?.status === "CLOSED" && <p>This desk closed before both fighters could begin.</p>}
      {inviteUrl && <><p>Share this private invitation:</p><button onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copy invite link</button></>}
      <div className={styles.roster}>{lobby?.players.map((player) => <div key={player.playerId}><strong>{player.displayName}</strong><span>{player.ready ? "Ready" : "Choosing stance"}</span></div>)}</div>
      {me && !me.ready && <button className={styles.primary} onClick={ready}>Ready up</button>}
      {lobby?.status === "COUNTDOWN" && <strong className={styles.countdown}>Match begins in 3…</strong>}
      {feed.error && <p role="alert">{feed.error}</p>}
    </section></main>;
  }
  return <><MatchView cosmetics={cosmetics} feed={feed} onChangeSharpener={() => { leave(); router.push("/"); }} />
    {activeEmote && <div className={styles["emote-bubble"]}>{activeEmote.player === feed.localSeat ? "You" : "Opponent"}: {activeEmote.label}</div>}
    <div className={styles["emote-desk"]} aria-label="Quick chat">
      {(["NICE_SHOT", "OOPS", "WOW", "SO_CLOSE", "GOOD_LUCK", "GOOD_GAME"] satisfies EmoteId[]).map((id) =>
        <button key={id} onClick={() => emote(id)}>{id.replaceAll("_", " ")}</button>)}
    </div>
  </>;
}
