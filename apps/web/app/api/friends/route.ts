import { FriendRoomCreateRequestSchema } from "@sharpener/protocol";
import { requireApiIdentity } from "@/server/adapters/identity-adapter";
import { apiError, assertSameOrigin, enforceRateLimits, readJson, runtimeVersions } from "@/server/http";
import { getMultiplayerRuntime } from "@/server/runtime";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireApiIdentity();
    await enforceRateLimits({ request, identity, scope: "friend-create", accountLimit: 10 });
    const input = FriendRoomCreateRequestSchema.parse(await readJson(request));
    const result = await getMultiplayerRuntime().service.createFriendRoom({
      identity,
      operationId: input.operationId,
      cosmeticId: input.cosmeticId,
      versions: runtimeVersions(input.clientBuildId),
      origin: new URL(request.url).origin,
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return apiError(error); }
}
