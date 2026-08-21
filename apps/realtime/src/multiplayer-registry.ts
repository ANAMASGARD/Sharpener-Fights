import { randomBytes as nodeRandomBytes } from "node:crypto";
import {
  SharpenerCosmeticIdSchema,
  type InviteMetadata,
  type InviteState,
  type SharpenerCosmeticId,
} from "@sharpener/protocol";

const INVITE_TTL_MS = 15 * 60 * 1_000;

type SeatClaim = {
  userId: string;
  sessionId: string;
  roomId: string;
};

type QueueEntry = {
  userId: string;
  sessionId: string;
  cosmeticId: SharpenerCosmeticId;
  sequence: number;
};

type InviteOwner = InviteMetadata & { userId: string };

type RegistryOptions = {
  now?: () => number;
  randomBytes?: (length: number) => Uint8Array;
};

type RateAction = "ADMISSION" | "QUEUE" | "FRIEND_CREATE";

const RATE_RULES: Record<RateAction, { limit: number; windowMs: number }> = {
  ADMISSION: { limit: 20, windowMs: 60_000 },
  QUEUE: { limit: 10, windowMs: 60_000 },
  FRIEND_CREATE: { limit: 5, windowMs: 10 * 60_000 },
};

export interface MultiplayerRegistry {
  claimSeat(claim: SeatClaim):
    | { accepted: true }
    | { accepted: false; reason: "ACTIVE_SEAT" | "RATE_LIMITED" };
  canReclaim(claim: SeatClaim): boolean;
  releaseSeat(userId: string, roomId: string): void;
  createInvite(input: {
    userId: string;
    roomId: string;
    hostDisplayName: string;
    hostAvatarUrl: string | null;
  }):
    | { accepted: true; invite: InviteMetadata }
    | { accepted: false; reason: "ACTIVE_INVITE" | "RATE_LIMITED" };
  resolveInvite(code: string): InviteMetadata | null;
  findInviteByRoom(roomId: string): InviteMetadata | null;
  setInviteState(roomId: string, state: InviteState): void;
  enqueue(input: Omit<QueueEntry, "sequence">):
    | { status: "WAITING"; position: number }
    | { status: "MATCHED"; players: readonly [QueueEntry, QueueEntry] }
    | { status: "ALREADY_QUEUED"; position: number }
    | { status: "RATE_LIMITED" };
  leaveQueue(userId: string): void;
}

export function createMultiplayerRegistry(
  options: RegistryOptions = {},
): MultiplayerRegistry {
  return new InMemoryMultiplayerRegistry(options);
}

class InMemoryMultiplayerRegistry implements MultiplayerRegistry {
  private readonly seats = new Map<string, SeatClaim>();
  private readonly invites = new Map<string, InviteOwner>();
  private readonly inviteByUser = new Map<string, string>();
  private readonly queue: QueueEntry[] = [];
  private readonly attempts = new Map<string, number[]>();
  private sequence = 0;
  private readonly now: () => number;
  private readonly entropy: (length: number) => Uint8Array;

  constructor(options: RegistryOptions) {
    this.now = options.now ?? Date.now;
    this.entropy = options.randomBytes ?? nodeRandomBytes;
  }

  claimSeat(claim: SeatClaim) {
    if (!this.consume("ADMISSION", claim.userId)) {
      return { accepted: false as const, reason: "RATE_LIMITED" as const };
    }
    const active = this.seats.get(claim.userId);
    if (active && (active.roomId !== claim.roomId || active.sessionId !== claim.sessionId)) {
      return { accepted: false as const, reason: "ACTIVE_SEAT" as const };
    }
    this.seats.set(claim.userId, claim);
    return { accepted: true as const };
  }

  canReclaim(claim: SeatClaim) {
    const active = this.seats.get(claim.userId);
    return Boolean(
      active &&
        active.roomId === claim.roomId &&
        active.sessionId === claim.sessionId,
    );
  }

  releaseSeat(userId: string, roomId: string) {
    if (this.seats.get(userId)?.roomId === roomId) this.seats.delete(userId);
  }

  createInvite(input: {
    userId: string;
    roomId: string;
    hostDisplayName: string;
    hostAvatarUrl: string | null;
  }) {
    if (!this.consume("FRIEND_CREATE", input.userId)) {
      return { accepted: false as const, reason: "RATE_LIMITED" as const };
    }
    const existingCode = this.inviteByUser.get(input.userId);
    const existing = existingCode ? this.resolveInvite(existingCode) : null;
    if (existing?.state === "AVAILABLE") {
      return { accepted: false as const, reason: "ACTIVE_INVITE" as const };
    }

    const code = Buffer.from(this.entropy(16)).toString("base64url");
    const invite: InviteOwner = {
      code,
      roomId: input.roomId,
      hostDisplayName: input.hostDisplayName.slice(0, 20),
      hostAvatarUrl: input.hostAvatarUrl,
      expiresAtMs: this.now() + INVITE_TTL_MS,
      state: "AVAILABLE",
      userId: input.userId,
    };
    this.invites.set(code, invite);
    this.inviteByUser.set(input.userId, code);
    return { accepted: true as const, invite: this.publicInvite(invite) };
  }

  resolveInvite(code: string) {
    const invite = this.invites.get(code);
    if (!invite) return null;
    if (invite.state === "AVAILABLE" && this.now() >= invite.expiresAtMs) {
      invite.state = "EXPIRED";
      this.inviteByUser.delete(invite.userId);
    }
    return this.publicInvite(invite);
  }

  findInviteByRoom(roomId: string) {
    const invite = [...this.invites.values()].find((candidate) => candidate.roomId === roomId);
    return invite ? this.resolveInvite(invite.code) : null;
  }

  setInviteState(roomId: string, state: InviteState) {
    for (const invite of this.invites.values()) {
      if (invite.roomId !== roomId) continue;
      invite.state = state;
      if (state !== "AVAILABLE") this.inviteByUser.delete(invite.userId);
    }
  }

  enqueue(input: Omit<QueueEntry, "sequence">) {
    if (!this.consume("QUEUE", input.userId)) {
      return { status: "RATE_LIMITED" as const };
    }
    const existing = this.queue.findIndex((entry) => entry.userId === input.userId);
    if (existing >= 0) {
      return { status: "ALREADY_QUEUED" as const, position: existing + 1 };
    }
    this.sequence += 1;
    this.queue.push({ ...input, sequence: this.sequence });
    this.queue.sort((left, right) => left.sequence - right.sequence);
    if (this.queue.length < 2) {
      return { status: "WAITING" as const, position: 1 };
    }
    const first = this.queue.shift();
    const second = this.queue.shift();
    if (!first || !second) throw new Error("FIFO queue lost a matched player");
    return {
      status: "MATCHED" as const,
      players: [first, this.withDistinctCosmetic(first, second)] as const,
    };
  }

  leaveQueue(userId: string) {
    const index = this.queue.findIndex((entry) => entry.userId === userId);
    if (index >= 0) this.queue.splice(index, 1);
  }

  private withDistinctCosmetic(first: QueueEntry, second: QueueEntry): QueueEntry {
    if (first.cosmeticId !== second.cosmeticId) return second;
    const alternate = SharpenerCosmeticIdSchema.options.find(
      (cosmetic) => cosmetic !== first.cosmeticId,
    );
    if (!alternate) throw new Error("At least two cosmetics are required");
    return { ...second, cosmeticId: alternate };
  }

  private consume(action: RateAction, userId: string) {
    const now = this.now();
    const rule = RATE_RULES[action];
    const key = `${action}:${userId}`;
    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => now - timestamp < rule.windowMs,
    );
    if (recent.length >= rule.limit) {
      this.attempts.set(key, recent);
      return false;
    }
    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  private publicInvite(invite: InviteOwner): InviteMetadata {
    const { userId: _userId, ...metadata } = invite;
    return { ...metadata };
  }
}
