import { WebhookHandler, type WebhookEvent } from "@liveblocks/node";
import { after } from "next/server";
import { getMultiplayerRuntime } from "@/server/runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.LIVEBLOCKS_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook is not configured." }, { status: 503 });
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > 65_536) {
    return Response.json({ error: "Webhook body is too large." }, { status: 413 });
  }
  const rawBody = await request.text();
  if (rawBody.length > 65_536) {
    return Response.json({ error: "Webhook body is too large." }, { status: 413 });
  }
  let event: WebhookEvent;
  try {
    event = new WebhookHandler(secret).verifyRequest({ headers: request.headers, rawBody });
  } catch {
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  try {
    if (event.type !== "userLeft" || !event.data.userId) return new Response(null, { status: 204 });
    const eventId = request.headers.get("webhook-id") ?? `${event.data.roomId}:${event.data.connectionId}:${event.data.leftAt}`;
    const update = await getMultiplayerRuntime().service.handleConnectionLeft({
      eventId,
      roomId: event.data.roomId,
      publicUserId: event.data.userId,
      connectionId: event.data.connectionId,
    });
    if (update) after(() => getMultiplayerRuntime().realtime.publish(update).catch(() => undefined));
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Webhook processing is temporarily unavailable." }, { status: 503 });
  }
}
