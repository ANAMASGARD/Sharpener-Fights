import { MatchmakingJoinRequestSchema } from "@sharpener/protocol";
import { requireApiIdentity } from "@/server/adapters/identity-adapter";
import { apiError, assertSameOrigin, enforceRateLimits, readJson, runtimeVersions } from "@/server/http";
import { getMultiplayerRuntime } from "@/server/runtime";

export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireApiIdentity();
    await enforceRateLimits({ request, identity, scope: "queue-join", accountLimit: 30 });
    const input = MatchmakingJoinRequestSchema.parse(await readJson(request));
    const result = await getMultiplayerRuntime().service.joinMatchmaking({
      identity,
      ticketId: input.ticketId,
      cosmeticId: input.cosmeticId,
      regionPool: input.regionPool,
      versions: runtimeVersions(input.clientBuildId),
    });
    return Response.json(result, {
      headers: result.status === "WAITING" ? { "Retry-After": String(result.retryAfterMs / 1_000) } : {},
    });
  } catch (error) { return apiError(error); }
}

export async function GET(request: Request) {
  try {
    const identity = await requireApiIdentity();
    const url = new URL(request.url);
    const ticketId = url.searchParams.get("ticketId") ?? "";
    const regionPool = url.searchParams.get("regionPool") ?? "global";
    await enforceRateLimits({ request, identity, scope: "queue-status", accountLimit: 180 });
    const result = await getMultiplayerRuntime().service.matchmakingStatus(identity, ticketId, regionPool);
    return Response.json(result, {
      headers: result.status === "WAITING" ? { "Retry-After": String(result.retryAfterMs / 1_000), "Cache-Control": "no-store" } : { "Cache-Control": "no-store" },
    });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireApiIdentity();
    const url = new URL(request.url);
    const ticketId = url.searchParams.get("ticketId") ?? "";
    const regionPool = url.searchParams.get("regionPool") ?? "global";
    await enforceRateLimits({ request, identity, scope: "queue-cancel", accountLimit: 60 });
    await getMultiplayerRuntime().service.cancelMatchmaking(identity, ticketId, regionPool);
    return new Response(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
