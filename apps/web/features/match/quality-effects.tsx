"use client";

import {
  Component,
  Suspense,
  lazy,
  type ErrorInfo,
  type ReactNode,
} from "react";

const LazyHighTierEffects = lazy(() =>
  import("./high-tier-effects").then(({ HighTierEffectsImpl }) => ({
    default: HighTierEffectsImpl,
  })),
);

class OptionalEffectsBoundary extends Component<
  { children: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  private reported = false;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (this.reported) return;
    this.reported = true;
    console.warn("High-tier ambient occlusion was disabled.", error, info);
    this.props.onUnavailable();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function HighTierEffects({
  enabled,
  onUnavailable,
}: {
  enabled: boolean;
  onUnavailable: () => void;
}) {
  if (!enabled) return null;

  return (
    <OptionalEffectsBoundary onUnavailable={onUnavailable}>
      <Suspense fallback={null}>
        <LazyHighTierEffects onUnavailable={onUnavailable} />
      </Suspense>
    </OptionalEffectsBoundary>
  );
}
