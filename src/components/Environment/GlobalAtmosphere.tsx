import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { getSceneLocal, type SceneId } from "../../timeline/timeline";
import { journeyEnvironmentState } from "../../state/journeyEnvironmentState";
import { skyState } from "../../state/skyState";
import { useQuality } from "../../effects/renderQuality";

interface Palette {
  /** Horizon colour. Doubles as the fog colour, so terrain fogs into the sky rather than into a wall. */
  sky: string;
  /** Colour overhead. Authored rather than derived, because the horizon-to-zenith shift is the
   * difference between "afternoon" and "evening" and no formula gets it right for every weather. */
  zenith: string;
  sun: string;
  ambient: number;
  fogNear: number;
  fogFar: number;
  /** 0 = clear, 1 = solid overcast. */
  cloud: number;
  /** Key-light strength. Defaults to `DEFAULT_SUN` — only scenes with genuinely different weather set it. */
  sunIntensity?: number;
}

/** Directional-light intensity every scene uses unless its palette overrides it. */
const DEFAULT_SUN = 2.6;

/** Where the key light is. The sky's sun disc is placed off this same vector, so they cannot drift. */
const SUN_POSITION = new THREE.Vector3(10, 16, 8);

const DAY: Palette = { sky: "#bcd9f0", zenith: "#4d8ccc", sun: "#fff6e8", ambient: 0.55, fogNear: 20, fogFar: 90, cloud: 0.34 };
const GOLDEN: Palette = { sky: "#f0c987", zenith: "#6f7fb4", sun: "#ffdca0", ambient: 0.5, fogNear: 16, fogFar: 80, cloud: 0.42 };
const COOL: Palette = { sky: "#cfe9ff", zenith: "#5d9ad6", sun: "#eaf6ff", ambient: 0.6, fogNear: 22, fogFar: 100, cloud: 0.2 };
const SUNSET: Palette = { sky: "#f3b878", zenith: "#40548c", sun: "#ffd9a0", ambient: 0.48, fogNear: 14, fogFar: 70, cloud: 0.52 };
/** First light over a colliery: low overcast, coal smoke in the air, and a horizon that closes in
 * at 44 metres — so the lanterns and the brazier are doing real work rather than decorating a
 * daylit scene, and the rails run away into nothing at the end of the shot. */
const PIT_DAWN: Palette = { sky: "#6e6a63", zenith: "#3b3d41", sun: "#c9b79a", ambient: 0.26, fogNear: 8, fogFar: 44, cloud: 0.9, sunIntensity: 0.95 };

const PALETTES: Partial<Record<SceneId, Palette>> = {
  earlyRail: PIT_DAWN,
  boarding: DAY,
  interior: DAY,
  departure: DAY,
  journey: DAY,
  exteriorRide: GOLDEN,
  modernRide: COOL,
  arrival: SUNSET,
};

/**
 * Global sky/fog/lighting for every scene except Evolution (which drives its own dusk->day
 * progression internally to tell the "steam to modern" story). Colors ease toward each scene's
 * target palette rather than snapping, so even hard-cut scenes get a brief, cinematic color settle.
 *
 * This also publishes the sky into [skyState], where `SkyDome` draws it and bakes the reflection
 * probe from it. Fog colour, key-light colour, key-light direction and the sky the viewer sees are
 * therefore all one description rather than three that have to be kept in step by hand.
 */
export function GlobalAtmosphere() {
  const { scene } = useThree();
  const quality = useQuality();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef(new THREE.Fog(new THREE.Color(DAY.sky).getHex(), DAY.fogNear, DAY.fogFar));
  const skyColor = useRef(new THREE.Color(DAY.sky));
  const sunColor = useRef(new THREE.Color(DAY.sun));

  useEffect(() => {
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame((_, delta) => {
    const { scene: activeScene } = getSceneLocal(timelineStore.getElapsed());
    if (activeScene.id === "evolution") return; // EvolutionScene owns the fog and the sky while active

    scene.fog = fogRef.current;
    const target = PALETTES[activeScene.id] ?? DAY;
    const damp = 1 - Math.pow(0.001, delta);

    skyColor.current.lerp(new THREE.Color(target.sky), damp);
    sunColor.current.lerp(new THREE.Color(target.sun), damp);
    fogRef.current.color.copy(skyColor.current);
    fogRef.current.near = THREE.MathUtils.lerp(fogRef.current.near, target.fogNear, damp);
    fogRef.current.far = THREE.MathUtils.lerp(fogRef.current.far, target.fogFar, damp);

    // Tree-shadow flicker + tunnel dark-out, driven by JourneyScene's per-frame environment state —
    // sunlight dips briefly as foliage passes, then drops steeply while "inside" the tunnel.
    let lightFactor = 1;
    let tunnel = 0;
    if (activeScene.id === "journey" && journeyEnvironmentState.active) {
      const { hasFoliage, distance, tunnelFactor } = journeyEnvironmentState;
      tunnel = tunnelFactor;
      if (hasFoliage && tunnelFactor <= 0) {
        // Fast, semi-irregular dips as individual tree shadows sweep across the cabin.
        const flicker = Math.sin(distance * 2.1) * Math.sin(distance * 5.3 + 1.7);
        lightFactor = THREE.MathUtils.lerp(1, 0.72, Math.max(flicker, 0));
      }
      lightFactor *= THREE.MathUtils.lerp(1, 0.04, tunnelFactor);
    }

    skyState.horizon.copy(skyColor.current);
    skyState.zenith.set(target.zenith);
    skyState.sun.copy(sunColor.current);
    skyState.sunDirection.copy(SUN_POSITION).normalize();
    skyState.cloudCover = target.cloud;
    // Only the tunnel darkens the sky. Passing tree shadows dim the train, not the daylight above it.
    skyState.dim = THREE.MathUtils.lerp(1, 0.04, tunnel);

    if (dirLightRef.current) {
      dirLightRef.current.color.copy(sunColor.current);
      dirLightRef.current.intensity = THREE.MathUtils.lerp(dirLightRef.current.intensity, (target.sunIntensity ?? DEFAULT_SUN) * lightFactor, damp * 6);
    }
    const fill = target.ambient * Math.max(lightFactor, 0.3);
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, fill, damp);
    }
    if (hemiRef.current) {
      // Sky/ground bounce tracks the same fill, or a dark scene would still sit under a bright dome.
      hemiRef.current.color.copy(skyColor.current);
      hemiRef.current.intensity = THREE.MathUtils.lerp(hemiRef.current.intensity, (fill / DAY.ambient) * 0.4, damp);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={DAY.ambient} />
      {/* The sky half of the hemisphere light tracks the palette (see above), so an overcast pit
          dawn fills from a grey sky and a sunset fills from an orange one, rather than both being
          lit from a permanently white dome. */}
      <hemisphereLight ref={hemiRef} color={DAY.sky} groundColor="#5a5548" intensity={0.4} />
      {/* `shadow-radius` is, in r186, the control that makes a shadow soft: the PCF taps are
          spread by radius * texel, so raising it is what restores the contact-softening edge the
          film used to get from the (now deleted) PCFSoft map type.
          Shadow frustum is tighter than the scene is wide on purpose: the shot is always within
          ~20m of the track, and halving the frustum doubles the shadow texel density where it is
          actually seen. `normalBias` is what removes the peter-panning the old bias left behind. */}
      <directionalLight
        ref={dirLightRef}
        position={[SUN_POSITION.x, SUN_POSITION.y, SUN_POSITION.z]}
        intensity={DEFAULT_SUN}
        castShadow
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-radius={5}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
    </>
  );
}
