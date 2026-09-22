import { ScrollField } from "./ScrollField";
import { groundColorTexture, groundNormalTexture, groundRoughnessTexture } from "../../materials/presets";
import { useDetailMap } from "../../materials/useDetailMap";

import * as THREE from "three";

/** Open terrain seen mostly at a grazing angle, so the relief reads long rather than deep. */
const TERRAIN_RELIEF = new THREE.Vector2(0.8, 0.8);

interface BiomeProps {
  distanceRef: React.MutableRefObject<number>;
  /** "both" mirrors the field on either side of the track; "left"/"right" places it on one side only. */
  side?: "both" | "left" | "right";
  density?: number;
}

function sides(side: "both" | "left" | "right", near: number, far: number): [number, number][] {
  const ranges: [number, number][] = [];
  if (side !== "right") ranges.push([-far, -near]);
  if (side !== "left") ranges.push([near, far]);
  return ranges;
}

/**
 * The terrain the ride scenes run over. This single plane fills the bottom half of the frame for
 * most of the film, so leaving it as an untextured fill was the largest flat surface in the project
 * — it now carries the same grain, roughness break-up and relief as the trackside ground.
 */
export function GroundStrip({ color, width = 200 }: { color: string; width?: number }) {
  const map = useDetailMap(groundColorTexture, 26, 52);
  const roughMap = useDetailMap(groundRoughnessTexture, 26, 52);
  const normalMap = useDetailMap(groundNormalTexture, 26, 52);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[width, 400]} />
      <meshStandardMaterial color={color} map={map} roughnessMap={roughMap} normalMap={normalMap} normalScale={TERRAIN_RELIEF} roughness={0.95} />
    </mesh>
  );
}

/** Conical trees scattered both sides of the track. */
export function TreeField({ distanceRef, side = "both", density = 1 }: BiomeProps) {
  return (
    <>
      {sides(side, 6, 20).map((xRange) => (
        <ScrollField
          key={xRange.join()}
          count={Math.round(26 * density)}
          cycleLength={70}
          xRange={xRange}
          distanceRef={distanceRef}
          yBase={1.1}
          scaleRange={[0.7, 1.5]}
        >
          <coneGeometry args={[1.0, 2.4, 8]} />
          <meshStandardMaterial color="#3d5a34" roughness={0.85} />
        </ScrollField>
      ))}
    </>
  );
}

/** Boxy buildings of varied size for a town/city backdrop. */
export function BuildingField({ distanceRef, side = "both", density = 1, tall = false }: BiomeProps & { tall?: boolean }) {
  const scaleRange: [number, number] = tall ? [2.5, 7] : [1.2, 3];
  return (
    <>
      {sides(side, 9, 30).map((xRange) => (
        <ScrollField
          key={xRange.join()}
          count={Math.round(18 * density)}
          cycleLength={90}
          xRange={xRange}
          distanceRef={distanceRef}
          yBase={0.5}
          scaleRange={scaleRange}
          parallax={0.9}
        >
          <boxGeometry args={[2, 1, 2]} />
          <meshStandardMaterial color={tall ? "#8892a0" : "#a89a7e"} roughness={0.8} />
        </ScrollField>
      ))}
    </>
  );
}

/** Low rolling hills, further back for depth. */
export function HillField({ distanceRef, side = "both", density = 1 }: BiomeProps) {
  return (
    <>
      {sides(side, 24, 55).map((xRange) => (
        <ScrollField
          key={xRange.join()}
          count={Math.round(10 * density)}
          cycleLength={120}
          xRange={xRange}
          distanceRef={distanceRef}
          yBase={-0.3}
          scaleRange={[6, 14]}
          parallax={0.5}
          castShadow={false}
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#6f8a5c" roughness={0.95} />
        </ScrollField>
      ))}
    </>
  );
}

/** Tall distant mountain silhouettes, slow parallax. */
export function MountainBackdrop({ distanceRef, side = "both", density = 1 }: BiomeProps) {
  return (
    <>
      {sides(side, 45, 90).map((xRange) => (
        <ScrollField
          key={xRange.join()}
          count={Math.round(8 * density)}
          cycleLength={160}
          xRange={xRange}
          distanceRef={distanceRef}
          yBase={-1}
          scaleRange={[16, 26]}
          parallax={0.25}
          castShadow={false}
        >
          <coneGeometry args={[1, 1.6, 4]} />
          <meshStandardMaterial color="#7c8a96" roughness={1} />
        </ScrollField>
      ))}
    </>
  );
}

/** Flattened crop-field patches for open countryside. */
export function FieldPatches({ distanceRef, side = "both", density = 1 }: BiomeProps) {
  return (
    <>
      {sides(side, 8, 26).map((xRange, i) => (
        <ScrollField
          key={xRange.join()}
          count={Math.round(12 * density)}
          cycleLength={80}
          xRange={xRange}
          distanceRef={distanceRef}
          yBase={0.02}
          scaleRange={[2.5, 4.5]}
          castShadow={false}
        >
          <boxGeometry args={[3.5, 0.04, 3.5]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#c9b45a" : "#8faa4f"} roughness={1} />
        </ScrollField>
      ))}
    </>
  );
}

/** A pair of bridge piers that recur once per cycle, suggesting the track periodically crosses a valley. */
export function BridgeCrossing({ distanceRef }: { distanceRef: React.MutableRefObject<number> }) {
  return (
    <ScrollField
      count={2}
      cycleLength={140}
      xRange={[-1.6, 1.6]}
      distanceRef={distanceRef}
      yBase={-2}
      scaleRange={[4, 4]}
      castShadow={false}
    >
      <cylinderGeometry args={[0.5, 0.7, 4, 8]} />
      <meshStandardMaterial color="#5a5f66" roughness={0.7} />
    </ScrollField>
  );
}
