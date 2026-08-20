export function supportsWebGL() {
  if (typeof document === "undefined") return false;

  const probe = document.createElement("canvas");
  try {
    const context =
      probe.getContext("webgl2", {
        failIfMajorPerformanceCaveat: false,
        powerPreference: "default",
      }) ??
      probe.getContext("webgl", {
        failIfMajorPerformanceCaveat: false,
        powerPreference: "default",
      });
    if (!context) return false;

    const loseContext = context.getExtension("WEBGL_lose_context");
    loseContext?.loseContext();
    return true;
  } catch {
    return false;
  }
}
