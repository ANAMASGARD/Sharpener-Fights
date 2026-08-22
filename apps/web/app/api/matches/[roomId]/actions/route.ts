import { MatchActionRequestSchema } from "@sharpener/protocol";
import { after } from "next/server";
import { requireApiIdentity } from "@/server/adapters/identity-adapter";
import { apiError, assertSameOrigin, enforceRateLimits, readJson, runtimeVersions } from "@/server/http";
import { getMultiplayerRuntime } from "@/server/runtime";

export const runtime = "nodejs";
export const maxDuration = 10;
type Context = { params: Promise<{ roomId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const identity = await requireApiIdentity();
    const { roomId } = await context.params;
    await enforceRateLimits({ request, identity, scope: "match-action", accountLimit: 120, roomId });
    const input = MatchActionRequestSchema.parse(await readJson(request));
    const result = await getMultiplayerRuntime().service.executeAction({
      identity,
      roomId,
      clientInstanceId: input.clientInstanceId,
      connectionId: input.connectionId,
      action: input.action,
      versions: runtimeVersions(input.clientBuildId),
    });
    const realtime = getMultiplayerRuntime().realtime;
    after(async () => {
      try {
        if (result.event) await realtime.publish(result.event);
        if (result.emote) await realtime.publishEmote({ roomId, actionId: result.response.actionId, ...result.emote });
      } catch (error) {
        console.error("Liveblocks notification failed; clients will recover by Redis revision", error instanceof Error ? error.message : "unknown error");
      }
    });
    return Response.json(result.response);
  } catch (error) { return apiError(error); }
}
