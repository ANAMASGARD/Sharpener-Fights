"use client";

import { EffectComposer, N8AO, ToneMapping } from "@react-three/postprocessing";
import { useCallback, useLayoutEffect, useState } from "react";
import {
  EffectComposer as EffectComposerImpl,
  ToneMappingMode,
} from "postprocessing";
import { installOptionalRenderGuard } from "./effect-fallback";

export function HighTierEffectsImpl({
  onUnavailable,
}: {
  onUnavailable: () => void;
}) {
  const [composer, setComposer] = useState<EffectComposerImpl | null>(null);
  const composerRef = useCallback((instance: EffectComposerImpl | null) => {
    setComposer(instance);
  }, []);

  useLayoutEffect(() => {
    if (!composer) return;
    return installOptionalRenderGuard(composer, (error) => {
      console.warn("High-tier ambient occlusion failed during rendering.", error);
      onUnavailable();
    });
  }, [composer, onUnavailable]);

  return (
    <EffectComposer ref={composerRef} multisampling={4}>
      <N8AO
        halfRes
        quality="performance"
        aoRadius={0.16}
        distanceFalloff={0.8}
        intensity={0.72}
        aoSamples={8}
        denoiseSamples={4}
        denoiseRadius={6}
        color="#252b25"
      />
      <ToneMapping mode={ToneMappingMode.AGX} />
    </EffectComposer>
  );
}
