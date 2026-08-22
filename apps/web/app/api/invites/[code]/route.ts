import { InviteClaimRequestSchema } from "@sharpener/protocol";
import { requireApiIdentity } from "@/server/adapters/identity-adapter";
import { apiError, assertSameOrigin, enforceRateLimits, readJson, runtimeVersions } from "@/server/http";
import { getMultiplayerRuntime } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ code: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { code } = await context.params;
    const result = await getMultiplayerRuntime().service.previewInvite(code);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const identity = await requireApiIdentity();
    await enforceRateLimits({ request, identity, scope: "invite-claim", accountLimit: 12 });
    const input = InviteClaimRequestSchema.parse(await readJson(request));
    const { code } = await context.params;
    const result = await getMultiplayerRuntime().service.claimInvite({
      identity,
      operationId: input.operationId,
      inviteCode: code,
      cosmeticId: input.cosmeticId,
      versions: runtimeVersions(input.clientBuildId),
    });
    return Response.json(result);
  } catch (error) { return apiError(error); }
}
