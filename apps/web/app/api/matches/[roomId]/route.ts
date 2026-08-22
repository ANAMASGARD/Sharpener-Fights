import { requireApiIdentity } from "@/server/adapters/identity-adapter";
import { apiError, enforceRateLimits } from "@/server/http";
import { getMultiplayerRuntime } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ roomId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const identity = await requireApiIdentity();
    const { roomId } = await context.params;
    await enforceRateLimits({ request, identity, scope: "match-recovery", accountLimit: 240, roomId });
    const afterRevision = Math.max(0, Number(new URL(request.url).searchParams.get("afterRevision") ?? 0) || 0);
    const result = await getMultiplayerRuntime().service.getSession(identity, roomId, afterRevision);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
