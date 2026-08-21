export function assertCompatibleBuild(clientBuildId: string, serverBuildId: string) {
  if (clientBuildId !== serverBuildId) {
    throw new Error("UPDATE_REQUIRED: refresh Sharpener Fights before joining a match");
  }
}
