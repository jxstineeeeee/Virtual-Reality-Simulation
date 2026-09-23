import { ScrollField } from "./ScrollField";
import { broadleafGeometry, coniferGeometry, hillGeometry, ridgeGeometry } from "./naturalGeometry";
import {
  cropFurrowNormalTexture,
  cropFurrowTexture,
  facadeEmissiveTexture,
  facadeTexture,
  groundAoTexture,
  groundColorTexture,
  groundNormalTexture,
  groundRoughnessTexture,
} from "../../materials/presets";
import { useDetailMap } from "../../materials/useDetailMap";

import * as THREE from "three";

/** Open terrain seen mostly at a grazing angle, so the relief reads long rather than deep. */
const TERRAIN_RELIEF = new THREE.Vector2(0.8, 0.8);
/** Ploughed ground: the furrows are the whole read, so they get more relief than the terrain does. */
const FURROW_RELIEF = new THREE.Vector2(1.1, 1.1);

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
 * — it now carries the same grain, roughness break-up, relief and contact occlusion as the
 * trackside ground.
 */
export function GroundStrip({ color, width = 200 }: { color: string; width?: number }) {
  const map = useDetailMap(groundColorTexture, 26, 52);
  const roughMap = useDetailMap(groundRoughnessTexture, 26, 52);
  const normalMap = useDetailMap(groundNormalTexture, 26, 52);
  const aoMap = useDetailMap(groundAoTexture, 26, 52);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[width, 400]} />
      <meshStandardMaterial
        color={color}
        map={map}
        roughnessMap={roughMap}
        normalMap={normalMap}
        normalScale={TERRAIN_RELIEF}
        aoMap={aoMap}
        aoMapIntensity={0.6}
        roughness={0.95}
      />
    </mesh>
  );
}

/**
 * Trees both sides of the track — spruce and broadleaf in roughly equal number.
 *
 * Two species rather than one is most of the improvement here. A line of identical silhouettes
 * scrolling past is the clearest possible sign of an instanced field, and no amount of per-instance
 * colour jitter hides it; two shapes interleaved at different scales reads as woodland.
 */
export function TreeField({ distanceRef, side = "both", density = 1 }: BiomeProps) {
  return (
    <>
      {sides(side, 6, 20).map((xRange) => (
        <group key={xRange.join()}>
          <ScrollField
            count={Math.round(16 * density)}
            cycleLength={70}
            xRange={xRange}
            distanceRef={distanceRef}
            yBase={0}
            scaleRange={[0.8, 1.7]}
          >
            <primitive object={coniferGeometry()} attach="geometry" />
            <meshStandardMaterial vertexColors roughness={0.85} />
          </ScrollField>
          <ScrollField
            count={Math.round(12 * density)}
            cycleLength={83}
            xRange={xRange}
            distanceRef={distanceRef}
            yBase={0}
            scaleRange={[0.9, 1.8]}
          >
            <primitive object={broadleafGeometry()} attach="geometry" />
            <meshStandardMaterial vertexColors roughness={0.88} />
          </ScrollField>
        </group>
      ))}
    </>
  );
}

/**
 * Buildings of varied size and proportion for a town or city backdrop.
 *
 * Two things changed here and both were doing the same damage. The boxes were untextured, so they
 * had no scale — nothing said whether one was a shed or a tower block. And they were scaled
 * uniformly, so a "tall" building was also an enormously wide one. Windows fix the first; a
 * separate vertical stretch fixes the second, which is what lets a skyline have a profile.
 */
export function BuildingField({ distanceRef, side = "both", density = 1, tall = false }: BiomeProps & { tall?: boolean }) {
  const facade = useDetailMap(() => facadeTexture(tall), 1, 1, 8, tall ? "tall" : "low");
  const lit = useDetailMap(() => facadeEmissiveTexture(tall), 1, 1, 8, tall ? "tall" : "low");
  const scaleRange: [number, number] = tall ? [2.2, 3.6] : [1.2, 3];
  const stretchRange: [number, number] = tall ? [2.2, 6] : [0.9, 1.6];
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
          stretchRange={stretchRange}
          parallax={0.9}
        >
          <boxGeometry args={[2, 1, 2]} />
          {/* The lit windows are an emissive map rather than part of the colour, so they hold up as
              the light goes: washed out at midday, and the thing that makes the town read at dusk. */}
          <meshStandardMaterial
            color={tall ? "#8892a0" : "#a89a7e"}
            map={facade}
            emissive="#ffca7a"
            emissiveMap={lit}
            emissiveIntensity={0.9}
            roughness={0.8}
          />
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
          yBase={0}
          scaleRange={[6, 14]}
          stretchRange={[0.7, 1.3]}
          parallax={0.5}
          castShadow={false}
        >
          <primitive object={hillGeometry()} attach="geometry" />
          <meshStandardMaterial vertexColors roughness={0.95} />
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
          yBase={0}
          scaleRange={[16, 26]}
          stretchRange={[0.8, 1.45]}
          parallax={0.25}
          castShadow={false}
          colorJitter={0.1}
        >
          <primitive object={ridgeGeometry()} attach="geometry" />
          <meshStandardMaterial vertexColors roughness={1} />
        </ScrollField>
      ))}
    </>
  );
}

/** Flattened crop-field patches for open countryside. */
export function FieldPatches({ distanceRef, side = "both", density = 1 }: BiomeProps) {
  const furrowRough = useDetailMap(cropFurrowTexture, 1, 1);
  const furrowNormal = useDetailMap(cropFurrowNormalTexture, 1, 1);
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
          {/* Drill rows. A field is never one flat colour from the air or from a train window — the
              furrows catch the low sun along their length, which is what makes a patch read as
              cultivated ground rather than as a green mat laid on the landscape. */}
          <meshStandardMaterial
            color={i % 2 === 0 ? "#c9b45a" : "#8faa4f"}
            roughnessMap={furrowRough}
            normalMap={furrowNormal}
            normalScale={FURROW_RELIEF}
            roughness={1}
          />
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
