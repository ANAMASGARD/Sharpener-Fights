import { Redis } from "@upstash/redis";
import type {
  AuthorityStore,
  CommitRoomInput,
  CommitRoomResult,
  InviteRecord,
  MatchmakingTicket,
  PairingResult,
  RoomRecord,
  SeatController,
} from "@sharpener/multiplayer-core";
import type {
  MatchActionResponse,
  MatchmakingStatusResponse,
  ShotResolution,
} from "@sharpener/protocol";

const KEY_LOCKING = "#!lua flags=allow-key-locking\n";
const ROOM_TTL_SECONDS = 60 * 60 * 6;
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 7;

function parse<T>(value: unknown): T {
  if (typeof value !== "string") throw new Error("Redis returned an invalid authority payload");
  return JSON.parse(value) as T;
}

function roomStateKey(roomId: string) { return `sf:match:${roomId}:state`; }
function roomLockKey(roomId: string) { return `sf:match:${roomId}:lock`; }
function roomHistoryKey(roomId: string) { return `sf:match:${roomId}:history`; }
function controllerKey(roomId: string, seat: 0 | 1) { return `sf:match:${roomId}:controller:${seat}`; }
function idempotencyKey(roomId: string, requestId: string) { return `sf:match:${roomId}:idempotency:${requestId}`; }
function operationKey(publicUserId: string, operationId: string) { return `sf:friend:operation:${publicUserId}:${operationId}`; }
function inviteKey(codeHash: string) { return `sf:invite:${codeHash}`; }
function inviteClaimKey(publicUserId: string, operationId: string) { return `sf:invite-claim:${publicUserId}:${operationId}`; }
function webhookEventKey(eventId: string) { return `sf:webhook:${eventId}`; }
function queuePrefix(region: string, gameVersion: number) { return `sf:queue:${region}:${gameVersion}`; }

export class UpstashAuthorityStore implements AuthorityStore {
  constructor(private readonly redis: Redis) {}

  static fromEnvironment() {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (!url || !token) throw new Error("Upstash Redis is not configured");
    return new UpstashAuthorityStore(new Redis({
      url,
      token,
      automaticDeserialization: false,
    }));
  }

  async now() {
    const [seconds, microseconds] = await this.redis.time();
    return seconds * 1_000 + Math.floor(microseconds / 1_000);
  }

  async createFriendRoom(room: RoomRecord, invite: InviteRecord) {
    const script = KEY_LOCKING + `
      local existing = redis.call('GET', KEYS[1])
      if existing then return existing end
      local state = cjson.decode(ARGV[1]); state.history = {}
      redis.call('SET', KEYS[2], cjson.encode(state), 'EX', ARGV[3])
      redis.call('SET', KEYS[3], ARGV[2], 'PXAT', ARGV[4])
      redis.call('SET', KEYS[1], cjson.encode(state), 'EX', ARGV[3])
      return cjson.encode(state)
    `;
    return parse<RoomRecord>(await this.redis.eval(script,
      [operationKey(invite.hostUserId, room.operationId), roomStateKey(room.roomId), inviteKey(invite.codeHash)],
      [JSON.stringify(room), JSON.stringify(invite), ROOM_TTL_SECONDS, invite.expiresAtMs],
    ));
  }

  async markProvisioning(roomId: string, status: RoomRecord["provisioningStatus"]) {
    const script = KEY_LOCKING + `
      local raw = redis.call('GET', KEYS[1]); if not raw then return 0 end
      local room = cjson.decode(raw)
      if room.provisioningStatus == 'READY' and ARGV[1] == 'PROVISIONING_FAILED' then return 0 end
      room.provisioningStatus = ARGV[1]
      redis.call('SET', KEYS[1], cjson.encode(room), 'KEEPTTL'); return 1
    `;
    await this.redis.eval(script, [roomStateKey(roomId)], [status]);
  }

  async findInvite(codeHash: string) {
    const raw = await this.redis.get<string>(inviteKey(codeHash));
    return raw ? parse<InviteRecord>(raw) : null;
  }

  async claimInvite(input: {
    codeHash: string;
    operationId: string;
    player: RoomRecord["players"][number];
  }) {
    const invite = await this.findInvite(input.codeHash);
    if (!invite) return null;
    const script = KEY_LOCKING + `
      local replay = redis.call('GET', KEYS[3])
      if replay then return replay end
      local inviteRaw = redis.call('GET', KEYS[1]); if not inviteRaw then return nil end
      local invite = cjson.decode(inviteRaw)
      local time = redis.call('TIME'); local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
      if invite.state ~= 'AVAILABLE' or tonumber(invite.expiresAtMs) <= now then return nil end
      local roomRaw = redis.call('GET', KEYS[2]); if not roomRaw then return nil end
      local room = cjson.decode(roomRaw)
      if room.provisioningStatus ~= 'READY' or #room.players ~= 1 then return nil end
      table.insert(room.players, cjson.decode(ARGV[1])); room.updatedAtMs = now
      invite.state = 'CLAIMED'
      redis.call('SET', KEYS[2], cjson.encode(room), 'KEEPTTL')
      redis.call('SET', KEYS[1], cjson.encode(invite), 'KEEPTTL')
      local result = cjson.encode({ room = room, seat = 1 })
      redis.call('SET', KEYS[3], result, 'EX', ARGV[2]); return result
    `;
    const raw = await this.redis.eval(script,
      [inviteKey(input.codeHash), roomStateKey(invite.roomId), inviteClaimKey(input.player.playerId, input.operationId)],
      [JSON.stringify(input.player), IDEMPOTENCY_TTL_SECONDS],
    );
    return raw ? parse<{ room: RoomRecord; seat: 1 }>(raw) : null;
  }

  async getRoom(roomId: string) {
    const pipeline = this.redis.pipeline();
    pipeline.get(roomStateKey(roomId));
    pipeline.lrange(roomHistoryKey(roomId), 0, -1);
    const [rawRoom, rawHistory] = await pipeline.exec<[string | null, string[]]>();
    if (!rawRoom) return null;
    const room = parse<RoomRecord>(rawRoom);
    room.history = (rawHistory ?? []).map((value) => parse<ShotResolution>(value));
    return room;
  }

  async acquireRoomLock(roomId: string, token: string, ttlMs: number) {
    return (await this.redis.set(roomLockKey(roomId), token, { nx: true, px: ttlMs })) === "OK";
  }

  async releaseRoomLock(roomId: string, token: string) {
    const script = KEY_LOCKING + `
      if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
      return 0
    `;
    await this.redis.eval(script, [roomLockKey(roomId)], [token]);
  }

  async commitRoom(input: CommitRoomInput): Promise<CommitRoomResult> {
    const script = KEY_LOCKING + `
      local replay = redis.call('GET', KEYS[3]); if replay then return 'REPLAYED|' .. replay end
      if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 'LOCK_LOST' end
      local currentRaw = redis.call('GET', KEYS[1]); if not currentRaw then return 'STALE_REVISION' end
      local current = cjson.decode(currentRaw)
      if tonumber(current.revision) ~= tonumber(ARGV[2]) then return 'STALE_REVISION' end
      local next = cjson.decode(ARGV[3]); next.history = {}
      redis.call('SET', KEYS[1], cjson.encode(next), 'EX', ARGV[6])
      if ARGV[5] ~= '' then
        redis.call('RPUSH', KEYS[4], ARGV[5]); redis.call('LTRIM', KEYS[4], -16, -1); redis.call('EXPIRE', KEYS[4], ARGV[6])
      end
      redis.call('SET', KEYS[3], ARGV[4], 'EX', ARGV[7])
      redis.call('DEL', KEYS[2]); return 'COMMITTED|' .. ARGV[4]
    `;
    const value = String(await this.redis.eval(script,
      [roomStateKey(input.roomId), roomLockKey(input.roomId), idempotencyKey(input.roomId, input.requestId), roomHistoryKey(input.roomId)],
      [input.lockToken, input.expectedRevision, JSON.stringify(input.nextRoom), JSON.stringify(input.response), input.resolution ? JSON.stringify(input.resolution) : "", ROOM_TTL_SECONDS, IDEMPOTENCY_TTL_SECONDS],
    ));
    if (value === "LOCK_LOST" || value === "STALE_REVISION") return { status: value };
    const separator = value.indexOf("|");
    const status = value.slice(0, separator) as "COMMITTED" | "REPLAYED";
    return { status, response: parse<MatchActionResponse>(value.slice(separator + 1)) };
  }

  async pauseRoomForResolverError(input: { roomId: string; lockToken: string; expectedRevision: number; nowMs: number }) {
    const script = KEY_LOCKING + `
      if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 'LOCK_LOST' end
      local raw = redis.call('GET', KEYS[1]); if not raw then return 'STALE_REVISION' end
      local room = cjson.decode(raw); if tonumber(room.revision) ~= tonumber(ARGV[2]) then return 'STALE_REVISION' end
      room.status = 'PAUSED_ERROR'; room.deadline = cjson.null; room.revision = room.revision + 1; room.updatedAtMs = tonumber(ARGV[3])
      redis.call('SET', KEYS[1], cjson.encode(room), 'KEEPTTL'); redis.call('DEL', KEYS[2]); return 'PAUSED'
    `;
    return await this.redis.eval<unknown[], "PAUSED" | "LOCK_LOST" | "STALE_REVISION">(
      script, [roomStateKey(input.roomId), roomLockKey(input.roomId)],
      [input.lockToken, input.expectedRevision, input.nowMs],
    );
  }

  async getIdempotentResponse(roomId: string, requestId: string) {
    const raw = await this.redis.get<string>(idempotencyKey(roomId, requestId));
    return raw ? parse<MatchActionResponse>(raw) : null;
  }

  async enqueueAndPair(ticket: MatchmakingTicket, room: RoomRecord): Promise<PairingResult> {
    const prefix = queuePrefix(ticket.regionPool, ticket.versions.gameVersion);
    const script = KEY_LOCKING + `
      local now = tonumber(ARGV[3]); local ids = redis.call('ZRANGE', KEYS[1], 0, -1)
      for _, id in ipairs(ids) do
        local raw = redis.call('HGET', KEYS[2], id)
        if not raw then
          redis.call('ZREM', KEYS[1], id); redis.call('HDEL', KEYS[2], id)
        elseif tonumber(cjson.decode(raw).heartbeatExpiresAtMs) <= now then
          local stale = cjson.decode(raw)
          redis.call('ZREM', KEYS[1], id); redis.call('HDEL', KEYS[2], id); redis.call('HDEL', KEYS[3], id)
          if redis.call('HGET', KEYS[4], stale.publicUserId) == id then redis.call('HDEL', KEYS[4], stale.publicUserId) end
        end
      end
      local ticket = cjson.decode(ARGV[2])
      local previous = redis.call('HGET', KEYS[3], ARGV[1])
      if previous then
        local previousTicket = redis.call('HGET', KEYS[2], ARGV[1])
        if previousTicket then
          local refreshed = cjson.decode(previousTicket); refreshed.heartbeatExpiresAtMs = ticket.heartbeatExpiresAtMs
          redis.call('HSET', KEYS[2], ARGV[1], cjson.encode(refreshed))
        end
        return previous
      end
      local accountTicket = redis.call('HGET', KEYS[4], ticket.publicUserId)
      if accountTicket and accountTicket ~= ticket.ticketId then
        local accountStatus = redis.call('HGET', KEYS[3], accountTicket)
        if accountStatus and cjson.decode(accountStatus).status == 'MATCHED' then return accountStatus end
        local oldRaw = redis.call('HGET', KEYS[2], accountTicket)
        if oldRaw then ticket.enteredAtMs = cjson.decode(oldRaw).enteredAtMs end
        redis.call('ZREM', KEYS[1], accountTicket); redis.call('HDEL', KEYS[2], accountTicket); redis.call('HDEL', KEYS[3], accountTicket)
      end
      redis.call('HSET', KEYS[4], ticket.publicUserId, ticket.ticketId)
      redis.call('HSET', KEYS[2], ticket.ticketId, cjson.encode(ticket)); redis.call('ZADD', KEYS[1], ticket.enteredAtMs, ticket.ticketId)
      ids = redis.call('ZRANGE', KEYS[1], 0, -1); local opponent = nil
      for _, id in ipairs(ids) do
        if id ~= ticket.ticketId then
          local raw = redis.call('HGET', KEYS[2], id)
          if raw and cjson.decode(raw).publicUserId ~= ticket.publicUserId then opponent = cjson.decode(raw); break end
        end
      end
      if not opponent then
        local rank = redis.call('ZRANK', KEYS[1], ticket.ticketId)
        local waiting = cjson.encode({ status = 'WAITING', ticketId = ticket.ticketId, position = rank + 1, retryAfterMs = 500 })
        redis.call('HSET', KEYS[3], ticket.ticketId, waiting); redis.call('EXPIRE', KEYS[1], ARGV[5]); redis.call('EXPIRE', KEYS[2], ARGV[5]); redis.call('EXPIRE', KEYS[3], ARGV[5]); redis.call('EXPIRE', KEYS[4], ARGV[5])
        return waiting
      end
      local first = opponent; local second = ticket
      if tonumber(ticket.enteredAtMs) < tonumber(opponent.enteredAtMs) then first = ticket; second = opponent end
      local room = cjson.decode(ARGV[4]); room.players = {
        { playerId=first.publicUserId, displayName=first.displayName, avatarUrl=first.avatarUrl, seat=0, cosmeticId=first.cosmeticId, ready=false, connected=true },
        { playerId=second.publicUserId, displayName=second.displayName, avatarUrl=second.avatarUrl, seat=1, cosmeticId=second.cosmeticId, ready=false, connected=true }
      }; room.history = {}
      if room.players[1].cosmeticId == room.players[2].cosmeticId then
        if room.players[1].cosmeticId == 'ocean-blue' then room.players[2].cosmeticId = 'ember-red'
        else room.players[2].cosmeticId = 'ocean-blue' end
      end
      redis.call('SET', KEYS[5], cjson.encode(room), 'EX', ARGV[5])
      redis.call('ZREM', KEYS[1], first.ticketId, second.ticketId); redis.call('HDEL', KEYS[2], first.ticketId, second.ticketId)
      redis.call('HDEL', KEYS[4], first.publicUserId, second.publicUserId)
      local a = cjson.encode({ status='MATCHED', ticketId=first.ticketId, roomId=room.roomId, seat=0 })
      local b = cjson.encode({ status='MATCHED', ticketId=second.ticketId, roomId=room.roomId, seat=1 })
      redis.call('HSET', KEYS[3], first.ticketId, a, second.ticketId, b); return redis.call('HGET', KEYS[3], ticket.ticketId)
    `;
    const raw = await this.redis.eval(script,
      [`${prefix}:order`, `${prefix}:tickets`, `${prefix}:status`, `${prefix}:accounts`, roomStateKey(room.roomId)],
      [ticket.ticketId, JSON.stringify(ticket), await this.now(), JSON.stringify(room), ROOM_TTL_SECONDS],
    );
    const result = parse<MatchmakingStatusResponse>(raw);
    if (result.status === "WAITING") return { status: "WAITING", position: result.position };
    const matchedRoom = await this.getRoom(result.roomId);
    if (!matchedRoom) throw new Error("Matchmaking committed without a room");
    return { status: "MATCHED", room: matchedRoom, seat: result.seat };
  }

  async getTicketStatus(
    ticketId: string,
    publicUserId: string,
    regionPool: string,
    gameVersion: number,
    heartbeatExpiresAtMs: number,
  ) {
    const prefix = queuePrefix(regionPool, gameVersion);
    const script = KEY_LOCKING + `
      local status = redis.call('HGET', KEYS[1], ARGV[1]); if not status then return nil end
      local decoded = cjson.decode(status)
      if decoded.status == 'WAITING' then
        local raw = redis.call('HGET', KEYS[2], ARGV[1]); if not raw then return nil end
        local ticket = cjson.decode(raw); if ticket.publicUserId ~= ARGV[2] then return nil end
        ticket.heartbeatExpiresAtMs = tonumber(ARGV[3])
        redis.call('HSET', KEYS[2], ARGV[1], cjson.encode(ticket))
      end
      return status
    `;
    const raw = await this.redis.eval(script,
      [`${prefix}:status`, `${prefix}:tickets`],
      [ticketId, publicUserId, heartbeatExpiresAtMs],
    );
    return raw ? parse<MatchmakingStatusResponse>(raw) : null;
  }

  async cancelTicket(ticketId: string, publicUserId: string, regionPool: string, gameVersion: number) {
    const prefix = queuePrefix(regionPool, gameVersion);
    const script = KEY_LOCKING + `
      local raw = redis.call('HGET', KEYS[2], ARGV[1]); if not raw then return 0 end
      if cjson.decode(raw).publicUserId ~= ARGV[2] then return 0 end
      redis.call('ZREM', KEYS[1], ARGV[1]); redis.call('HDEL', KEYS[2], ARGV[1]); redis.call('HDEL', KEYS[3], ARGV[1])
      if redis.call('HGET', KEYS[4], ARGV[2]) == ARGV[1] then redis.call('HDEL', KEYS[4], ARGV[2]) end
      return 1
    `;
    await this.redis.eval(script, [`${prefix}:order`, `${prefix}:tickets`, `${prefix}:status`, `${prefix}:accounts`], [ticketId, publicUserId]);
  }

  async acquireController(input: {
    roomId: string;
    seat: 0 | 1;
    controller: SeatController;
    force: boolean;
  }) {
    const script = KEY_LOCKING + `
      if redis.call('EXISTS', KEYS[1]) == 0 then return 'PASSIVE' end
      local raw = redis.call('GET', KEYS[2]); local current = raw and cjson.decode(raw) or nil
      local next = cjson.decode(ARGV[1])
      if current and tonumber(current.expiresAtMs) > tonumber(ARGV[2]) and current.clientInstanceId ~= next.clientInstanceId and ARGV[3] ~= '1' then return 'PASSIVE' end
      redis.call('SET', KEYS[2], cjson.encode(next), 'EX', ARGV[4]); return 'ACTIVE'
    `;
    return await this.redis.eval<unknown[], "ACTIVE" | "PASSIVE">(
      script, [roomStateKey(input.roomId), controllerKey(input.roomId, input.seat)],
      [JSON.stringify(input.controller), await this.now(), input.force ? 1 : 0, ROOM_TTL_SECONDS],
    );
  }

  async getController(roomId: string, seat: 0 | 1) {
    const raw = await this.redis.get<string>(controllerKey(roomId, seat));
    return raw ? parse<SeatController>(raw) : null;
  }

  async pauseForDisconnect(input: {
    eventId: string;
    roomId: string;
    publicUserId: string;
    connectionId: number;
    nowMs: number;
    reconnectEndsAtMs: number;
  }) {
    const room = await this.getRoom(input.roomId);
    const seat = room?.players.find((player) => player.playerId === input.publicUserId)?.seat;
    if (seat === undefined) return null;
    const script = KEY_LOCKING + `
      if redis.call('EXISTS', KEYS[2]) == 1 then return nil end
      redis.call('SET', KEYS[2], '1', 'EX', ARGV[6])
      local raw = redis.call('GET', KEYS[1]); if not raw then return nil end
      local room = cjson.decode(raw); local seat = nil
      for index, player in ipairs(room.players) do if player.playerId == ARGV[1] then seat = index - 1 end end
      if seat == nil or tonumber(seat) ~= tonumber(ARGV[7]) then return nil end
      local controllerRaw = redis.call('GET', KEYS[3]); if not controllerRaw then return nil end
      local controller = cjson.decode(controllerRaw)
      if not controller or tonumber(controller.connectionId) ~= tonumber(ARGV[2]) then return nil end
      room.pausedFromStatus = room.status; room.status = 'PAUSED_RECONNECT'
      room.deadline = { kind='RECONNECT', endsAtMs=tonumber(ARGV[4]), playerId=ARGV[1] }
      room.players[seat + 1].connected = false; room.revision = room.revision + 1; room.updatedAtMs = tonumber(ARGV[3])
      redis.call('SET', KEYS[1], cjson.encode(room), 'KEEPTTL'); return cjson.encode(room)
    `;
    const raw = await this.redis.eval(script,
      [roomStateKey(input.roomId), webhookEventKey(input.eventId), controllerKey(input.roomId, seat)],
      [input.publicUserId, input.connectionId, input.nowMs, input.reconnectEndsAtMs, input.eventId, IDEMPOTENCY_TTL_SECONDS, seat],
    );
    return raw ? parse<RoomRecord>(raw) : null;
  }

  async resumeAfterReconnect(roomId: string, publicUserId: string, nowMs: number) {
    const script = KEY_LOCKING + `
      local raw = redis.call('GET', KEYS[1]); if not raw then return nil end
      local room = cjson.decode(raw)
      if room.status ~= 'PAUSED_RECONNECT' or not room.deadline or room.deadline.playerId ~= ARGV[1] then return nil end
      local seat = nil; for index, player in ipairs(room.players) do if player.playerId == ARGV[1] then seat = index end end
      if seat == nil then return nil end
      room.players[seat].connected = true; room.status = room.pausedFromStatus or 'PLAYING'; room.pausedFromStatus = nil
      if room.status == 'PLAYING' then room.deadline = { kind='TURN', endsAtMs=tonumber(ARGV[2]) + 15000 }
      elseif room.status == 'COUNTDOWN' then room.deadline = { kind='COUNTDOWN', endsAtMs=tonumber(ARGV[2]) + 3000 }
      else room.deadline = cjson.null end
      room.revision = room.revision + 1; room.updatedAtMs = tonumber(ARGV[2])
      redis.call('SET', KEYS[1], cjson.encode(room), 'KEEPTTL'); return cjson.encode(room)
    `;
    const raw = await this.redis.eval(script, [roomStateKey(roomId)], [publicUserId, nowMs]);
    return raw ? parse<RoomRecord>(raw) : null;
  }
}
