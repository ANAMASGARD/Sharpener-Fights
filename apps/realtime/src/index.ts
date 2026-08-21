import { defineRoom, defineServer } from "colyseus";
import type express from "express";
import { FightRoom } from "./fight-room";
import { InstantQueueRoom } from "./queue-room";
import { getServerContext } from "./server-context";

const port = Number(process.env.PORT ?? 2567);
const allowedOrigins = (process.env.ALLOWED_WEB_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const server = defineServer({
  rooms: {
    sharpener_match: defineRoom(FightRoom),
    instant_queue: defineRoom(InstantQueueRoom),
  },
  express: (app: express.Application) => {
    app.get("/invites/:code", (request, response) => {
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.includes(origin)) {
        response.status(403).json({ error: "Origin is not allowed" });
        return;
      }
      const invite = getServerContext().registry.resolveInvite(request.params.code);
      if (!invite) {
        response.status(404).json({ error: "Invitation not found" });
        return;
      }
      response.json(invite);
    });
  },
});

await server.listen(port);
console.log(`Sharpener Fights realtime server listening on ${port}`);
