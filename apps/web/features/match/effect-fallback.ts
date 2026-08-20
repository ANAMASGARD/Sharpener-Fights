export function guardOptionalRender(
  render: (deltaTime: number) => void,
  onUnavailable: (error: unknown) => void,
) {
  let failed = false;

  return (deltaTime: number) => {
    if (failed) return;
    try {
      render(deltaTime);
    } catch (error) {
      failed = true;
      onUnavailable(error);
    }
  };
}

export type OptionalRenderTarget = {
  render(deltaTime: number): void;
};

export function installOptionalRenderGuard(
  target: OptionalRenderTarget,
  onUnavailable: (error: unknown) => void,
) {
  const originalRender = target.render;
  target.render = guardOptionalRender(
    (deltaTime) => originalRender.call(target, deltaTime),
    onUnavailable,
  );
  return () => {
    target.render = originalRender;
  };
}
