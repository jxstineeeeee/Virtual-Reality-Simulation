import { useEffect, useRef } from "react";
import * as THREE from "three";
import { groundColorTexture, groundNormalTexture, groundRoughnessTexture, woodGrainTexture, woodNormalTexture } from "../../materials/presets";
import { useDetailMap } from "../../materials/useDetailMap";

/** Wooden rail gauge (half-distance from centreline). Narrower than the standard gauge the rest of
 * the film runs on — a colliery waggonway was built to whatever the local wagons happened to be. */
export const WAGGONWAY_HALF_GAUGE = 0.6;

const TRACK_LENGTH = 120;
const TRACK_START_Z = 20;
const TRACK_END_Z = TRACK_START_Z - TRACK_LENGTH;
const SLEEPER_SPACING = 1.15;
const sleeperCount = Math.floor(TRACK_LENGTH / SLEEPER_SPACING);

/**
 * Rails were plain oak baulks until collieries started nailing thin iron straps over the running
 * surface to stop them wearing out — the first metal rail, and the reason this stretch changes
 * halfway along. Everything from here toward the pit is bare timber; everything ahead is strapped.
 */
const STRAP_FROM_Z = 6;
const strapLength = STRAP_FROM_Z - TRACK_END_Z;

/** Churned, rutted pit ground has far more relief than ballast does; sawn oak has the grain only. */
const MUD_RELIEF = new THREE.Vector2(1.6, 1.6);
const TIMBER_RELIEF = new THREE.Vector2(1, 1);

/** A colliery waggonway: oak rails on half-buried timber sleepers, run through churned pit dirt. */
export function Waggonway() {
  const sleeperRef = useRef<THREE.InstancedMesh>(null);
  const stoneRef = useRef<THREE.InstancedMesh>(null);

  const dirtMap = useDetailMap(groundColorTexture, 12, 30);
  const dirtRoughMap = useDetailMap(groundRoughnessTexture, 12, 30);
  const dirtNormalMap = useDetailMap(groundNormalTexture, 12, 30);
  const railMap = useDetailMap(woodGrainTexture, 1, 90);
  const railNormalMap = useDetailMap(woodNormalTexture, 1, 90);
  const sleeperNormalMap = useDetailMap(woodNormalTexture, 1, 1);

  useEffect(() => {
    const sleepers = sleeperRef.current;
    if (!sleepers) return;
    const dummy = new THREE.Object3D();
    const shade = new THREE.Color();
    for (let i = 0; i < sleeperCount; i++) {
      // Hand-laid track: every sleeper sits a little crooked and a little deeper in the mud than the last.
      const z = TRACK_START_Z - i * SLEEPER_SPACING;
      dummy.position.set(Math.sin(i * 4.7) * 0.05, 0.03 - Math.abs(Math.sin(i * 2.3)) * 0.02, z);
      dummy.rotation.set(Math.sin(i * 1.7) * 0.02, Math.sin(i * 3.1) * 0.05, Math.sin(i * 5.9) * 0.03);
      dummy.updateMatrix();
      sleepers.setMatrixAt(i, dummy.matrix);
      const g = 0.7 + Math.abs(Math.sin(i * 9.3)) * 0.4;
      shade.setRGB(g, g, g);
      sleepers.setColorAt(i, shade);
    }
    sleepers.instanceMatrix.needsUpdate = true;
    if (sleepers.instanceColor) sleepers.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => {
    const stones = stoneRef.current;
    if (!stones) return;
    const dummy = new THREE.Object3D();
    // Loose stone and spilled coal kicked out of the wagons, thickest where they're loaded.
    for (let i = 0; i < 90; i++) {
      const z = TRACK_START_Z - Math.abs(Math.sin(i * 1.7)) * 46;
      const x = (Math.sin(i * 3.9) + Math.sin(i * 7.1) * 0.5) * 2.6;
      const s = 0.05 + Math.abs(Math.sin(i * 11.3)) * 0.12;
      dummy.position.set(x, s * 0.35, z);
      dummy.rotation.set(i * 0.7, i * 1.3, i * 0.4);
      dummy.scale.set(s, s * 0.6, s);
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);
    }
    stones.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      {/* Churned pit ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, TRACK_START_Z - TRACK_LENGTH / 2]} receiveShadow>
        <planeGeometry args={[70, TRACK_LENGTH + 30]} />
        <meshStandardMaterial color="#6a5844" map={dirtMap} roughnessMap={dirtRoughMap} normalMap={dirtNormalMap} normalScale={MUD_RELIEF} roughness={1} />
      </mesh>
      {/* The wagon way itself — a raised, rutted causeway of packed spoil the track is laid on */}
      <mesh position={[0, 0.02, TRACK_START_Z - TRACK_LENGTH / 2]} receiveShadow>
        <boxGeometry args={[2.8, 0.06, TRACK_LENGTH]} />
        <meshStandardMaterial color="#5e4d3a" roughness={1} />
      </mesh>

      {/* Oak rails */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * WAGGONWAY_HALF_GAUGE, 0.11, TRACK_START_Z - TRACK_LENGTH / 2]} castShadow receiveShadow>
          <boxGeometry args={[0.15, 0.12, TRACK_LENGTH]} />
          <meshStandardMaterial color="#5a4327" map={railMap} normalMap={railNormalMap} normalScale={TIMBER_RELIEF} roughness={0.85} />
        </mesh>
      ))}

      {/* Iron strap nailed over the running surface on the newer half of the line */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * WAGGONWAY_HALF_GAUGE, 0.176, STRAP_FROM_Z - strapLength / 2]} castShadow>
          <boxGeometry args={[0.1, 0.014, strapLength]} />
          <meshStandardMaterial color="#584a3e" metalness={0.75} roughness={0.55} />
        </mesh>
      ))}

      <instancedMesh ref={sleeperRef} args={[undefined, undefined, sleeperCount]} receiveShadow castShadow>
        <boxGeometry args={[1.75, 0.13, 0.2]} />
        <meshStandardMaterial color="#4a3826" normalMap={sleeperNormalMap} normalScale={TIMBER_RELIEF} roughness={0.95} />
      </instancedMesh>

      <instancedMesh ref={stoneRef} args={[undefined, undefined, 90]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#2e2a26" roughness={0.9} metalness={0.08} />
      </instancedMesh>
    </group>
  );
}
