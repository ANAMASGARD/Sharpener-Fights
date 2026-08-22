import { z } from "zod";
import { requireApiIdentity } from "@/server/adapters/identity-adapter";
import { apiError, assertSameOrigin, enforceRateLimits, readJson } from "@/server/http";
import { getMultiplayerRuntime } from "@/server/runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireApiIdentity();
    const { room } = z.object({ room: z.string().min(1).max(128) }).parse(await readJson(request));
    await enforceRateLimits({ request, identity, scope: "liveblocks-auth", accountLimit: 60, roomId: room });
    await getMultiplayerRuntime().service.getSession(identity, room, 0);
    const authResponse = await getMultiplayerRuntime().realtime.authorize({ roomId: room, ...identity });
    return new Response(authResponse.body, { status: authResponse.status });
  } catch (error) { return apiError(error); }
}
