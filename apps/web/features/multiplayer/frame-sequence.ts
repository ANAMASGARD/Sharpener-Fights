export function acceptsAuthoritativeFrame(
  latestFrameSequence: number,
  incomingFrameSequence: number,
) {
  return incomingFrameSequence > latestFrameSequence;
}
