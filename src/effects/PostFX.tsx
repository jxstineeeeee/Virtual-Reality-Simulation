import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

/** Subtle cinematic grade: bloom on hot highlights (headlamps, signage, embers) + a soft vignette. Kept cheap on purpose. */
export function PostFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom luminanceThreshold={0.78} luminanceSmoothing={0.3} intensity={0.4} mipmapBlur radius={0.45} />
      <Vignette eskil={false} offset={0.22} darkness={0.55} />
    </EffectComposer>
  );
}
