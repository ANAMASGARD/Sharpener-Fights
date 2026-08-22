"use client";

import { createPredictionSimulation, type PredictionSimulation } from "@sharpener/game-core";
import {
  MatchRealtimeEventSchema,
  type EmoteId,
  type GameEvent,
  type GameSnapshot,
  type MatchAction,
  type MatchActionResponse,
  type MatchRecoveryResponse,
  type MatchView,
  type PlayerIndex,
  type ShotCommand,
  type ShotResolution,
} from "@sharpener/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MatchFeed } from "../match/match-feed";
import type { MatchCosmetics } from "../match/sharpener-selector";
import { enterMatchRoom } from "./liveblocks-client";
import { getClientInstanceId, multiplayerApi, operationId } from "./multiplayer-api";
import { playbackToSnapshot, playResolution } from "./playback";

export function useOnlineMatch(roomId: string) {
  const predictionRef = useRef<PredictionSimulation | null>(null);
  const revisionRef = useRef(0);
  const connectionIdRef = useRef<number | undefined>(undefined);
  const clientInstanceRef = useRef<string>("");
  const playbackAbortRef = useRef<AbortController | null>(null);
  const heardShots = useRef(new Set<string>());
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [acceptedShotId, setAcceptedShotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState<PlayerIndex>(0);
  const [lobby, setLobby] = useState<MatchView | null>(null);
  const [controllerMode, setControllerMode] = useState<"ACTIVE" | "PASSIVE">("ACTIVE");
  const [activeEmote, setActiveEmote] = useState<{ player: PlayerIndex; label: string } | null>(null);

  const installAuthoritativeState = useCallback((view: MatchView, nextSnapshot: GameSnapshot) => {
    revisionRef.current = view.revision;
    setLobby(view);
    setSnapshot(nextSnapshot);
    if (predictionRef.current) predictionRef.current.restoreSnapshot(nextSnapshot);
    else void createPredictionSimulation(nextSnapshot).then((simulation) => { predictionRef.current = simulation; });
  }, []);

  const replayResolutions = useCallback((resolutions: readonly ShotResolution[]) => {
    playbackAbortRef.current?.abort();
    const controller = new AbortController();
    playbackAbortRef.current = controller;
    void (async () => {
      for (const resolution of resolutions) {
        if (controller.signal.aborted) return;
        if (!heardShots.current.has(resolution.command.shotId)) {
          heardShots.current.add(resolution.command.shotId);
          setAcceptedShotId(resolution.command.shotId);
        }
        await playResolution({
          roomId,
          resolution,
          signal: controller.signal,
          onSnapshot: setSnapshot,
          onEvents: setEvents,
        });
      }
      const finalResolution = resolutions.at(-1);
      if (!controller.signal.aborted && finalResolution) {
        const authoritative = playbackToSnapshot(roomId, finalResolution.finalState);
        if (predictionRef.current) predictionRef.current.restoreSnapshot(authoritative);
        else predictionRef.current = await createPredictionSimulation(authoritative);
        setSnapshot(authoritative);
      }
    })();
  }, [roomId]);

  const replayResolution = useCallback((resolution: ShotResolution) => {
    replayResolutions([resolution]);
  }, [replayResolutions]);

  const applyRecovery = useCallback((recovery: MatchRecoveryResponse) => {
    if (recovery.type === "FULL") {
      installAuthoritativeState(recovery.view, playbackToSnapshot(roomId, recovery.playbackState));
      return;
    }
    if (recovery.currentRevision <= revisionRef.current) return;
    replayResolutions(recovery.resolutions);
    revisionRef.current = recovery.currentRevision;
    setLobby(recovery.view);
  }, [installAuthoritativeState, replayResolutions, roomId]);

  const synchronize = useCallback(async (afterRevision = revisionRef.current) => {
    const session = await multiplayerApi.session(roomId, afterRevision);
    setSeat(session.seat);
    applyRecovery(session.recovery);
  }, [applyRecovery, roomId]);

  const applyActionResponse = useCallback((response: MatchActionResponse) => {
    revisionRef.current = Math.max(revisionRef.current, response.revision);
    setLobby(response.view);
    if (response.resolution) replayResolution(response.resolution);
    else installAuthoritativeState(response.view, playbackToSnapshot(roomId, response.playbackState));
  }, [installAuthoritativeState, replayResolution, roomId]);

  const submit = useCallback(async (action: MatchAction, quiet = false) => {
    try {
      if (!quiet) setError(null);
      const response = await multiplayerApi.action(
        roomId,
        clientInstanceRef.current,
        connectionIdRef.current,
        action,
      );
      applyActionResponse(response);
      return response;
    } catch (reason) {
      if (quiet) {
        await synchronize().catch(() => undefined);
      } else setError(reason instanceof Error ? reason.message : "The classroom action failed.");
      return null;
    }
  }, [applyActionResponse, roomId, synchronize]);

  useEffect(() => {
    let disposed = false;
    const clientInstanceId = getClientInstanceId();
    clientInstanceRef.current = clientInstanceId;
    const { room, leave } = enterMatchRoom(roomId, clientInstanceId);
    const unsubscribeEvent = room.subscribe("event", (message) => {
      if (message.connectionId !== -1 || message.user !== null) return;
      const parsed = MatchRealtimeEventSchema.safeParse(message.event);
      if (!parsed.success || parsed.data.roomId !== roomId) return;
      if (parsed.data.type === "MATCH_EMOTE") {
        const shown = { player: parsed.data.player, label: parsed.data.emoteId.replaceAll("_", " ") };
        setActiveEmote(shown);
        window.setTimeout(() => setActiveEmote((current) => current === shown ? null : current), Math.max(0, parsed.data.expiresAtMs - Date.now()));
        return;
      }
      if (parsed.data.revision <= revisionRef.current) return;
      if (parsed.data.revision === revisionRef.current + 1 && parsed.data.resolution) {
        const revision = parsed.data.revision;
        revisionRef.current = revision;
        replayResolution(parsed.data.resolution);
        setLobby(parsed.data.view);
      } else void synchronize(revisionRef.current).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not recover the latest turn."));
    });
    const claimControl = async () => {
      const self = room.getSelf();
      if (self) connectionIdRef.current = self.connectionId;
      const result = await multiplayerApi.controller(roomId, clientInstanceId, connectionIdRef.current ?? -1);
      if (!disposed) {
        setControllerMode(result.mode);
        if (result.view) setLobby(result.view);
      }
    };
    const unsubscribeStatus = room.subscribe("status", (status) => {
      if (status === "connected") void claimControl().catch(() => undefined);
    });
    const unsubscribeLost = room.subscribe("lost-connection", (event) => {
      if (event === "failed") setError("Realtime notifications were lost. The match will recover from Redis.");
    });
    void synchronize(0).then(claimControl).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not enter the classroom."));
    const controllerRenewal = window.setInterval(() => void claimControl().catch(() => undefined), 10_000);
    let recoveryTimeout: number | undefined;
    const scheduleRecovery = () => {
      if (disposed) return;
      recoveryTimeout = window.setTimeout(() => {
        void synchronize().catch(() => undefined).finally(scheduleRecovery);
      }, 5_000 + Math.floor(Math.random() * 5_001));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void synchronize().catch(() => undefined);
    };
    scheduleRecovery();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      unsubscribeEvent(); unsubscribeStatus(); unsubscribeLost();
      window.clearInterval(controllerRenewal);
      if (recoveryTimeout) window.clearTimeout(recoveryTimeout);
      document.removeEventListener("visibilitychange", onVisibility);
      playbackAbortRef.current?.abort(); predictionRef.current?.dispose(); predictionRef.current = null;
      leave();
    };
  }, [replayResolution, roomId, synchronize]);

  useEffect(() => {
    const deadline = lobby?.countdownEndsAtMs ?? lobby?.turnDeadlineMs ?? lobby?.reconnectDeadlineMs;
    if (!deadline) return;
    const kind = lobby?.countdownEndsAtMs ? "COUNTDOWN" : lobby?.turnDeadlineMs ? "TURN" : "RECONNECT";
    const timer = window.setTimeout(() => void submit({ type: "ADVANCE_DEADLINE", requestId: operationId("deadline"), expectedDeadlineKind: kind }, true), Math.max(0, deadline - Date.now()) + 40);
    return () => window.clearTimeout(timer);
  }, [lobby?.countdownEndsAtMs, lobby?.reconnectDeadlineMs, lobby?.turnDeadlineMs, submit]);

  const shoot = useCallback((command: ShotCommand) => {
    if (controllerMode !== "ACTIVE") return setError("This match is controlled by another tab.");
    const prediction = predictionRef.current;
    const result = prediction?.applyPredictedShot(command);
    if (prediction && result?.accepted) {
      heardShots.current.add(command.shotId);
      setAcceptedShotId(command.shotId);
      prediction.step();
      setSnapshot(prediction.getSnapshot());
    }
    void submit({ type: "SHOT", requestId: command.shotId, command });
  }, [controllerMode, submit]);

  const leave = useCallback(() => { void submit({ type: "LEAVE", requestId: operationId("leave") }, true); }, [submit]);
  const cosmetics: MatchCosmetics = lobby?.players.length === 2
    ? [lobby.players.find((player) => player.seat === 0)?.cosmeticId ?? "ember-red", lobby.players.find((player) => player.seat === 1)?.cosmeticId ?? "ocean-blue"]
    : ["ember-red", "ocean-blue"];
  const feed: MatchFeed = {
    snapshot, events, acceptedShotId, error, localSeat: seat, online: true, shoot,
    reset: () => { void submit({ type: "REMATCH_VOTE", requestId: operationId("rematch") }); },
  };
  return {
    feed,
    lobby,
    cosmetics,
    activeEmote,
    controllerMode,
    takeControl: () => void multiplayerApi.controller(roomId, clientInstanceRef.current, connectionIdRef.current ?? -1, true).then((result) => { setControllerMode(result.mode); if (result.view) setLobby(result.view); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not take control.")),
    leave,
    ready: () => void submit({ type: "READY", requestId: operationId("ready") }),
    emote: (emoteId: EmoteId) => void submit({ type: "EMOTE", requestId: operationId("emote"), emoteId }),
  };
}
