import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Cabin, STEAM_THEME } from "../components/Interior/Cabin";
import { GroundStrip, TreeField, BuildingField, HillField, FieldPatches, MountainBackdrop, BridgeCrossing } from "../components/Environment/Biomes";
import { STEAM_CABIN_PASSENGERS } from "./npcCasting";
import { WindowVideo } from "../assets/WindowVideo";
import { sampleShots, type Shot, type CameraShotResult } from "../components/Camera/shotUtils";
import { timelineStore } from "../state/timelineStore";
import { getSceneLocal } from "../timeline/timeline";
import { rampDistance } from "./sceneMotion";
import { journeyEnvironmentState, getTunnelFactor } from "../state/journeyEnvironmentState";

const RAMP_SECONDS = 4;
export const JOURNEY_CRUISE_SPEED = 10;

export function journeyDistance(local: number): number {
  return rampDistance(local, RAMP_SECONDS, JOURNEY_CRUISE_SPEED);
}

type Biome = "outskirts" | "town" | "countryside" | "fields" | "mountains";

// The 5-minute cut only plays this scene's first 27 design-seconds (see `SceneDef.designSpan`), so
// the run of biomes is compressed to fit rather than ending in the outskirts every time.
function biomeAt(local: number): Biome {
  if (local < 4) return "outskirts";
  if (local < 10) return "town";
  if (local < 16) return "countryside";
  if (local < 21) return "fields";
  return "mountains";
}

const GROUND_COLOR: Record<Biome, string> = {
  outskirts: "#8a7f68",
  town: "#8c8378",
  countryside: "#6f8a52",
  fields: "#7c9a4a",
  mountains: "#7a8a72",
};

const FOLIAGE_BIOMES = new Set<Biome>(["outskirts", "countryside", "fields", "mountains"]);

/** A row of warm point lights that sweeps along the cabin ceiling while `factor` (0..1) is above
 * zero — the "tunnel lights strobing past" beat called out in the realism brief's window-lighting
 * section. Silent/no-op the rest of the time. */
function TunnelLights({ factor }: { factor: number }) {
  const lightsRef = useRef<THREE.Group>(null);
  const sweep = useRef(0);

  useFrame((_, delta) => {
    if (factor <= 0.01 || !lightsRef.current) return;
    sweep.current += delta * 6;
    const positions = [-3, -1, 1, 3];
    lightsRef.current.children.forEach((child, i) => {
      const light = child as THREE.PointLight;
      const local = (positions[i] + sweep.current) % 6;
      light.intensity = factor * Math.max(0, 1 - Math.abs(((local + 9) % 6) - 3) / 1.2) * 1.8;
    });
  });

  if (factor <= 0.01) return null;
  return (
    <group ref={lightsRef}>
      {[0, 1, 2, 3].map((i) => (
        <pointLight key={i} position={[0, 2.05, i * 2 - 3]} color="#ffd9a0" distance={2.2} decay={2} />
      ))}
    </group>
  );
}

/** Scene 5 — the main riding experience: countryside scrolls past the windows while the camera looks around. */
export function JourneyScene() {
  const distanceRef = useRef(0);
  const doorOpenRef = useRef(0);
  const [biome, setBiome] = useState<Biome>("outskirts");
  const [tunnelFactor, setTunnelFactor] = useState(0);

  useEffect(() => {
    journeyEnvironmentState.active = true;
    return () => {
      journeyEnvironmentState.active = false;
    };
  }, []);

  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    const distance = journeyDistance(local);
    distanceRef.current = distance;
    const nextBiome = biomeAt(local);
    if (nextBiome !== biome) setBiome(nextBiome);
    const nextTunnel = getTunnelFactor(local);
    if (Math.abs(nextTunnel - tunnelFactor) > 0.01) setTunnelFactor(nextTunnel);

    journeyEnvironmentState.distance = distance;
    journeyEnvironmentState.hasFoliage = FOLIAGE_BIOMES.has(nextBiome);
    journeyEnvironmentState.tunnelFactor = nextTunnel;
  });

  return (
    <>
      <GroundStrip color={GROUND_COLOR[biome]} />
      <Cabin theme={STEAM_THEME} doorOpenRef={doorOpenRef} passengers={STEAM_CABIN_PASSENGERS} />
      <TunnelLights factor={tunnelFactor} />
      {/* Real footage behind the glass if one's been supplied under public/video/window/ — otherwise
          the 3D biome scenery below shows through the glass exactly as it already did. */}
      <WindowVideo src="/video/window/countryside.mp4" size={[9, 1.4]} position={[-1.3, 1.35, 0]} rotation={[0, Math.PI / 2, 0]} />
      <WindowVideo src="/video/window/countryside.mp4" size={[9, 1.4]} position={[1.3, 1.35, 0]} rotation={[0, -Math.PI / 2, 0]} />
      {(biome === "outskirts" || biome === "countryside" || biome === "fields") && (
        <TreeField distanceRef={distanceRef} density={biome === "countryside" ? 1.3 : 0.6} />
      )}
      {biome === "town" && <BuildingField distanceRef={distanceRef} density={1} />}
      {biome === "countryside" && <HillField distanceRef={distanceRef} />}
      {biome === "fields" && <FieldPatches distanceRef={distanceRef} />}
      {biome === "mountains" && (
        <>
          <TreeField distanceRef={distanceRef} density={0.4} />
          <MountainBackdrop distanceRef={distanceRef} />
          <BridgeCrossing distanceRef={distanceRef} />
        </>
      )}
    </>
  );
}

const SHOTS: Shot[] = [
  { t: 0, pos: [0.3, 1.4, 0.5], look: [0, 1.3, -3] },
  { t: 6, pos: [0.55, 1.15, 0.5], look: [0.9, 1.2, 0.5] },
  { t: 16, pos: [0.55, 1.15, -1], look: [0, 1.3, -3.5] },
  { t: 25, pos: [0.55, 1.15, -1], look: [-0.9, 1.2, -1] },
  { t: 35, pos: [0.55, 1.15, 1.5], look: [0, 1.3, -3] },
  { t: 46, pos: [0.55, 1.15, 1.5], look: [0.9, 1.2, 1.5] },
  { t: 55, pos: [0.3, 1.4, 0.5], look: [0, 1.3, -3] },
];

export function journeyShot(local: number): CameraShotResult {
  return sampleShots(local, SHOTS);
}
