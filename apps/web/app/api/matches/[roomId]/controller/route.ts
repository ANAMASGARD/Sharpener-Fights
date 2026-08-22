import { ControllerRequestSchema } from "@sharpener/protocol";
import { after } from "next/server";
import { requireApiIdentity } from "@/server/adapters/identity-adapter";
import { apiError, assertSameOrigin, enforceRateLimits, readJson } from "@/server/http";
import { getMultiplayerRuntime } from "@/server/runtime";

export const runtime = "nodejs";
type Context = { params: Promise<{ roomId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const identity = await requireApiIdentity();
    const { roomId } = await context.params;
    await enforceRateLimits({ request, identity, scope: "controller", accountLimit: 60, roomId });
    const input = ControllerRequestSchema.parse(await readJson(request));
    const result = await getMultiplayerRuntime().service.claimController({
      identity,
      roomId,
      clientInstanceId: input.clientInstanceId,
      connectionId: input.connectionId,
      force: input.force,
    });
    const { event, ...response } = result;
    if (event) after(() => getMultiplayerRuntime().realtime.publish(event).catch(() => undefined));
    return Response.json(response);
  } catch (error) { return apiError(error); }
}
