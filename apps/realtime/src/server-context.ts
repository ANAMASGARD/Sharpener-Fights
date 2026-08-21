import {
  createClerkIdentityAuthority,
  type IdentityAuthority,
} from "./identity-authority";
import {
  createMultiplayerRegistry,
  type MultiplayerRegistry,
} from "./multiplayer-registry";

export type ServerContext = {
  identity: IdentityAuthority;
  registry: MultiplayerRegistry;
};

let context: ServerContext | undefined;

export function getServerContext(): ServerContext {
  context ??= {
    identity: createClerkIdentityAuthority(),
    registry: createMultiplayerRegistry(),
  };
  return context;
}
