import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { getSceneLocal, type SceneId } from "../../timeline/timeline";
import { journeyEnvironmentState } from "../../state/journeyEnvironmentState";

interface Palette {
  sky: string;
  sun: string;
  ambient: number;
  fogNear: number;
  fogFar: number;
}

const DAY: Palette = { sky: "#bcd9f0", sun: "#fff6e8", ambient: 0.55, fogNear: 20, fogFar: 90 };
const GOLDEN: Palette = { sky: "#f0c987", sun: "#ffdca0", ambient: 0.5, fogNear: 16, fogFar: 80 };
const COOL: Palette = { sky: "#cfe9ff", sun: "#eaf6ff", ambient: 0.6, fogNear: 22, fogFar: 100 };
const SUNSET: Palette = { sky: "#f3b878", sun: "#ffd9a0", ambient: 0.48, fogNear: 14, fogFar: 70 };

const PALETTES: Partial<Record<SceneId, Palette>> = {
  preview: DAY,
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
 */
export function GlobalAtmosphere() {
  const { scene } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
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
    if (activeScene.id === "evolution") return; // EvolutionScene owns scene.fog/background while active

    scene.fog = fogRef.current;
    const target = PALETTES[activeScene.id] ?? DAY;
    const damp = 1 - Math.pow(0.001, delta);

    skyColor.current.lerp(new THREE.Color(target.sky), damp);
    sunColor.current.lerp(new THREE.Color(target.sun), damp);
    scene.background = skyColor.current;
    fogRef.current.color.copy(skyColor.current);
    fogRef.current.near = THREE.MathUtils.lerp(fogRef.current.near, target.fogNear, damp);
    fogRef.current.far = THREE.MathUtils.lerp(fogRef.current.far, target.fogFar, damp);

    // Tree-shadow flicker + tunnel dark-out, driven by JourneyScene's per-frame environment state —
    // sunlight dips briefly as foliage passes, then drops steeply while "inside" the tunnel.
    let lightFactor = 1;
    if (activeScene.id === "journey" && journeyEnvironmentState.active) {
      const { hasFoliage, distance, tunnelFactor } = journeyEnvironmentState;
      if (hasFoliage && tunnelFactor <= 0) {
        // Fast, semi-irregular dips as individual tree shadows sweep across the cabin.
        const flicker = Math.sin(distance * 2.1) * Math.sin(distance * 5.3 + 1.7);
        lightFactor = THREE.MathUtils.lerp(1, 0.72, Math.max(flicker, 0));
      }
      lightFactor *= THREE.MathUtils.lerp(1, 0.04, tunnelFactor);
    }

    if (dirLightRef.current) {
      dirLightRef.current.color.copy(sunColor.current);
      dirLightRef.current.intensity = THREE.MathUtils.lerp(dirLightRef.current.intensity, 2.6 * lightFactor, damp * 6);
    }
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, target.ambient * Math.max(lightFactor, 0.3), damp);
    }
  });

  return (
    <>
      {/* Low-res outdoor HDRI used only as a reflection source (background stays our own sky/fog) —
          gives glass, painted metal, and clearcoat surfaces real-looking highlights and reflections
          instead of the flat, matte look of lighting alone. */}
      <Environment preset="park" resolution={128} background={false} />
      <ambientLight ref={ambientRef} intensity={DAY.ambient} />
      <hemisphereLight color="#ffffff" groundColor="#5a5548" intensity={0.4} />
      <directionalLight
        ref={dirLightRef}
        position={[10, 16, 8]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0015}
      />
    </>
  );
}
