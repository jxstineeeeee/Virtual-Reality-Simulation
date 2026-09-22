import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  Noise,
  SMAA,
  SSAO,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import type { DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import { cameraFocusState } from "../state/cameraFocusState";
import { quality } from "./renderQuality";

/** Lateral colour fringing, in screen-space UV. Real glass does this; barely a pixel of it is plenty. */
const ABERRATION = new THREE.Vector2(0.0005, 0.0004);

/**
 * Keeps the lens focused on whatever the current shot is looking at, using the distance
 * `CameraDirector` publishes. `worldFocusDistance` is in metres, which is why the focus can be
 * driven straight from the blocking rather than from a normalised depth value nobody can reason about.
 */
function FocusPuller() {
  const dofRef = useRef<DepthOfFieldEffect>(null);

  useFrame(() => {
    const dof = dofRef.current;
    if (!dof) return;
    const distance = cameraFocusState.distance;
    dof.target = null;
    // A real lens has more depth of field the further out it focuses; this keeps the near cabin
    // shots shallow and the long shots down the track mostly sharp, instead of one fixed blur.
    dof.cocMaterial.worldFocusDistance = distance;
    dof.cocMaterial.worldFocusRange = THREE.MathUtils.clamp(distance * 0.55, 1.2, 14);
  });

  return <DepthOfField ref={dofRef} worldFocusDistance={6} worldFocusRange={3} bokehScale={2.6} resolutionScale={0.5} />;
}

/**
 * The camera the film is notionally shot on.
 *
 * Everything here is doing one job: removing the tells that read as "rendered" rather than "filmed".
 * Antialiasing first and above all — the composer previously ran with `multisampling={0}` and no
 * SMAA, so every roof line, rail and catenary wire in the film was a stepped staircase, which is the
 * single loudest give-away there is. Then focus, then the small optical imperfections (a touch of
 * fringing, a little grain, a vignette) that a clean render never has and no real lens is without.
 *
 * The chain scales with `quality`: ambient occlusion and MSAA are the expensive passes, so weaker
 * machines drop to the cheaper SMAA and go without AO rather than dropping frames.
 */
export function PostFX() {
  return (
    <EffectComposer
      multisampling={quality.multisampling}
      enableNormalPass={quality.ambientOcclusion}
      frameBufferType={THREE.HalfFloatType}
    >
      {/* Where surfaces meet, light doesn't reach. Without this, everything looks like it is
          floating a millimetre off whatever it is standing on. */}
      {quality.ambientOcclusion ? (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          rings={4}
          radius={0.1}
          // Deliberately understated. Overcooked AO puts dark halos around everything and reads
          // worse than no AO at all, so this is set to darken contacts and little else.
          intensity={12}
          luminanceInfluence={0.5}
          worldDistanceThreshold={40}
          worldDistanceFalloff={8}
          worldProximityThreshold={0.6}
          worldProximityFalloff={0.2}
          fade={0.02}
        />
      ) : (
        <></>
      )}

      {quality.depthOfField ? <FocusPuller /> : <></>}

      <Bloom luminanceThreshold={0.78} luminanceSmoothing={0.3} intensity={0.4} mipmapBlur radius={0.45} />

      {/* Film grade: a little more contrast and a little less saturation than the raw render, which
          is what stops the palette reading as poster-bright. */}
      <HueSaturation saturation={-0.06} />
      <BrightnessContrast brightness={-0.01} contrast={0.08} />

      <ChromaticAberration offset={ABERRATION} radialModulation modulationOffset={0.35} />
      <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.055} />
      <Vignette eskil={false} offset={0.22} darkness={0.55} />

      {/* MSAA already handled the edges on the top tier; the weakest tier gets SMAA instead, which
          is far cheaper and still hugely better than nothing. */}
      {quality.multisampling === 0 ? <SMAA /> : <></>}
    </EffectComposer>
  );
}
