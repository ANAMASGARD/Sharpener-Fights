"use client";

import { Client, type Room } from "@colyseus/sdk";

const RECONNECT_KEY = "sharpener-fights-reconnect";
let activeRoom: Room | null = null;

export function createRealtimeClient(token: string) {
  const endpoint = process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:2567";
  const client = new Client(endpoint);
  client.auth.token = token;
  return client;
}

export function rememberRoom(room: Room) {
  activeRoom = room;
  window.sessionStorage.setItem(RECONNECT_KEY, room.reconnectionToken);
}

export function getActiveRoom(roomId: string) {
  return activeRoom?.roomId === roomId ? activeRoom : null;
}

export function getReconnectToken(roomId: string) {
  const token = window.sessionStorage.getItem(RECONNECT_KEY);
  return token?.startsWith(`${roomId}:`) ? token : null;
}

export function clearRoom() {
  activeRoom = null;
  window.sessionStorage.removeItem(RECONNECT_KEY);
}
