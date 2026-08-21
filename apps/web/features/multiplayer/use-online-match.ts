"use client";

import { useAuth } from "@clerk/nextjs";
import type { Room } from "@colyseus/sdk";
import { createPredictionSimulation, type PredictionSimulation } from "@sharpener/game-core";
import {
  ServerRealtimeMessageSchema,
  type GameEvent,
  type GameSnapshot,
  type EmoteId,
  type LobbyMetadata,
  type ClientRealtimeMessage,
  type PlayerIndex,
  type ServerRealtimeMessage,
  type SharpenerCosmeticId,
  type ShotCommand,
} from "@sharpener/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchFeed } from "../match/match-feed";
import type { MatchCosmetics } from "../match/sharpener-selector";
import { acceptsAuthoritativeFrame } from "./frame-sequence";
import { clearRoom, createRealtimeClient, getActiveRoom, getReconnectToken, rememberRoom } from "./realtime-session";

function lobbyFromState(state: Record<string, unknown>): LobbyMetadata | null {
  try {
    const players = Array.from(state.players as Iterable<Record<string, unknown>>).map((player) => ({
      playerId: String(player.playerId), displayName: String(player.displayName),
      avatarUrl: player.avatarUrl ? String(player.avatarUrl) : null,
      seat: Number(player.seat) as PlayerIndex,
      cosmeticId: String(player.cosmeticId) as SharpenerCosmeticId,
      ready: Boolean(player.ready), connected: Boolean(player.connected),
    }));
    return {
      roomId: String(state.roomId), mode: String(state.mode) as LobbyMetadata["mode"],
      status: String(state.status) as LobbyMetadata["status"], players,
      countdownEndsAtMs: Number(state.countdownEndsAtMs) || null,
      reconnectDeadlineMs: Number(state.reconnectDeadlineMs) || null,
      rematchVotes: Array.from(state.rematchVotes as Iterable<number>) as PlayerIndex[],
    };
  } catch { return null; }
}

export function useOnlineMatch(roomId: string) {
  const { getToken } = useAuth();
  const roomRef = useRef<Room | null>(null);
  const predictionRef = useRef<PredictionSimulation | null>(null);
  const frameRef = useRef(-1);
  const heardShots = useRef(new Set<string>());
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [acceptedShotId, setAcceptedShotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState<PlayerIndex>(0);
  const [lobby, setLobby] = useState<LobbyMetadata | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [activeEmote, setActiveEmote] = useState<{ player: PlayerIndex; label: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    async function connect() {
      try {
        let room = getActiveRoom(roomId);
        if (!room) {
          const token = await getToken();
          if (!token) throw new Error("Your sign-in session has expired.");
          const reconnectToken = getReconnectToken(roomId);
          if (!reconnectToken) throw new Error("This room is no longer attached to this tab.");
          room = await createRealtimeClient(token).reconnect(reconnectToken);
          rememberRoom(room);
        }
        if (cancelled) return room.leave();
        roomRef.current = room;
        const onStateChange = (state: unknown) => {
          const next = lobbyFromState(state as unknown as Record<string, unknown>);
          if (next) setLobby(next);
        };
        room.onStateChange(onStateChange);
        cleanups.push(() => room.onStateChange.remove(onStateChange));
        onStateChange(room.state);
        cleanups.push(room.onMessage("server_message", (raw: unknown) => {
          const parsed = ServerRealtimeMessageSchema.safeParse(raw);
          if (!parsed.success) return setError("The server sent an incompatible update.");
          handleMessage(parsed.data);
        }));
        room.send("client_message", { type: "SYNC_REQUEST" });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not enter the classroom.");
      }
    }
    function handleMessage(message: ServerRealtimeMessage) {
      if (message.type === "SEAT_ASSIGNED") setSeat(message.seat);
      if (message.type === "INVITE_CREATED") setInviteUrl(`${window.location.origin}/invite/${message.invite.code}`);
      if (message.type === "ERROR") setError(message.message);
      if (message.type === "EMOTE_SHOWN") {
        const shown = { player: message.player, label: message.emoteId.replaceAll("_", " ") };
        setActiveEmote(shown);
        window.setTimeout(() => setActiveEmote((current) => current === shown ? null : current), Math.max(0, message.expiresAtMs - Date.now()));
      }
      if (message.type === "SHOT_ACCEPTED" && !heardShots.current.has(message.command.shotId)) {
        heardShots.current.add(message.command.shotId);
        setAcceptedShotId(message.command.shotId);
      }
      if (message.type === "GAME_FRAME" && acceptsAuthoritativeFrame(frameRef.current, message.frameSeq)) {
        frameRef.current = message.frameSeq;
        setSnapshot(message.snapshot);
        setEvents(message.events);
        if (predictionRef.current) predictionRef.current.restoreSnapshot(message.snapshot);
        else void createPredictionSimulation(message.snapshot).then((simulation) => {
          if (cancelled) simulation.dispose(); else predictionRef.current = simulation;
        });
      }
    }
    void connect();
    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
      predictionRef.current?.dispose();
      predictionRef.current = null;
    };
  }, [getToken, roomId]);

  const shoot = useCallback((command: ShotCommand) => {
    setError(null);
    const prediction = predictionRef.current;
    const result = prediction?.applyPredictedShot(command);
    if (prediction && result?.accepted) {
      heardShots.current.add(command.shotId);
      setAcceptedShotId(command.shotId);
      prediction.step();
      setSnapshot(prediction.getSnapshot());
    }
    roomRef.current?.send("client_message", command);
  }, []);
  const send = useCallback((message: ClientRealtimeMessage) => roomRef.current?.send("client_message", message), []);
  const leave = useCallback(() => {
    roomRef.current?.send("client_message", { type: "LEAVE" });
    roomRef.current?.leave();
    roomRef.current = null;
    clearRoom();
  }, []);
  const cosmetics: MatchCosmetics = lobby?.players.length === 2
    ? [lobby.players.find((player) => player.seat === 0)?.cosmeticId ?? "ember-red", lobby.players.find((player) => player.seat === 1)?.cosmeticId ?? "ocean-blue"]
    : ["ember-red", "ocean-blue"];
  const feed: MatchFeed = {
    snapshot, events, acceptedShotId, error, localSeat: seat, online: true, shoot,
    reset: () => send({ type: "REMATCH_VOTE" }),
  };
  return {
    feed,
    lobby,
    cosmetics,
    inviteUrl,
    activeEmote,
    leave,
    ready: () => send({ type: "READY" }),
    emote: (emoteId: EmoteId) => send({ type: "EMOTE", emoteId }),
  };
}
