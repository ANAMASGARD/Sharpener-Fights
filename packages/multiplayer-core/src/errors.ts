export type MultiplayerErrorCode =
  | "UNAUTHORIZED"
  | "ROOM_NOT_FOUND"
  | "ROOM_NOT_READY"
  | "ROOM_FULL"
  | "INVITE_UNAVAILABLE"
  | "UPDATE_REQUIRED"
  | "MATCH_INVALIDATED_BY_UPDATE"
  | "PASSIVE_TAB"
  | "LOCK_BUSY"
  | "STALE_REVISION"
  | "INVALID_ACTION"
  | "RESOLVER_BUDGET_EXCEEDED";

export class MultiplayerError extends Error {
  constructor(
    readonly code: MultiplayerErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MultiplayerError";
  }
}
