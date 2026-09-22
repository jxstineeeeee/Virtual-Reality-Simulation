import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  ballastColorTexture,
  ballastNormalTexture,
  groundColorTexture,
  groundNormalTexture,
  groundRoughnessTexture,
  railColorTexture,
  railNormalTexture,
  woodNormalTexture,
} from "../../materials/presets";
import { useDetailMap } from "../../materials/useDetailMap";

const TRACK_LENGTH = 140;
const TRACK_START_Z = -TRACK_LENGTH / 2;
const SLEEPER_SPACING = 1.0;
const POLE_SPACING = 9;
/** Overhead wires fade in once `progress` (0..1) crosses this band (roughly the diesel->electric transition). */
const WIRE_FADE_START = 0.36;
const WIRE_FADE_END = 0.42;

// Normal-map strength per surface: how deep the relief actually is on that material.
const GROUND_RELIEF = new THREE.Vector2(1.1, 1.1);
const BALLAST_RELIEF = new THREE.Vector2(1.5, 1.5);
const RAIL_RELIEF = new THREE.Vector2(0.35, 0.35);
const TIMBER_RELIEF = new THREE.Vector2(0.8, 0.8);

const GROUND_START = new THREE.Color("#8a7658");
const GROUND_END = new THREE.Color("#7d876f");
const BALLAST_START = new THREE.Color("#8f7a5e");
const BALLAST_END = new THREE.Color("#93989c");
const RAIL_START = new THREE.Color("#9a8266");
const RAIL_END = new THREE.Color("#b8bfc5");

const sleeperCount = Math.floor(TRACK_LENGTH / SLEEPER_SPACING);
const poleCount = Math.floor(TRACK_LENGTH / POLE_SPACING);

interface RailwayProps {
  /** 0..1 "how evolved" the surrounding infrastructure looks (steam-era timber -> modern steel). */
  progressRef: React.MutableRefObject<number>;
}

/** Long straight track: ground, ballast, rails, sleepers, and poles/catenary that evolve with `progressRef`. */
export function Railway({ progressRef }: RailwayProps) {
  const groundMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const ballastMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const railMatRefA = useRef<THREE.MeshStandardMaterial>(null);
  const railMatRefB = useRef<THREE.MeshStandardMaterial>(null);
  const wireMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const sleeperMeshRef = useRef<THREE.InstancedMesh>(null);
  const poleMeshRef = useRef<THREE.InstancedMesh>(null);
  const wireMeshRef = useRef<THREE.InstancedMesh>(null);

  const groundMap = useDetailMap(groundColorTexture, 10, 24);
  const groundRoughMap = useDetailMap(groundRoughnessTexture, 10, 24);
  const groundNormalMap = useDetailMap(groundNormalTexture, 10, 24);
  const ballastMap = useDetailMap(ballastColorTexture, 3, 60);
  const ballastNormalMap = useDetailMap(ballastNormalTexture, 3, 60);
  const railMap = useDetailMap(railColorTexture, 1, 70);
  const railNormalMap = useDetailMap(railNormalTexture, 1, 70);
  const sleeperNormalMap = useDetailMap(woodNormalTexture, 1, 1);

  useEffect(() => {
    const mesh = sleeperMeshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const shade = new THREE.Color();
    for (let i = 0; i < sleeperCount; i++) {
      dummy.position.set((Math.random() - 0.5) * 0.03, 0.06, TRACK_START_Z + i * SLEEPER_SPACING);
      dummy.rotation.set(0, (Math.random() - 0.5) * 0.03, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const g = 0.75 + Math.random() * 0.35;
      shade.setRGB(g, g, g);
      mesh.setColorAt(i, shade);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  useEffect(() => {
    const poles = poleMeshRef.current;
    const wires = wireMeshRef.current;
    if (!poles || !wires) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < poleCount; i++) {
      const z = TRACK_START_Z + i * POLE_SPACING;
      dummy.position.set(3.4, 2.1, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);

      if (i < poleCount - 1) {
        dummy.position.set(3.4, 4.15, z + POLE_SPACING / 2);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        wires.setMatrixAt(i, dummy.matrix);
      }
    }
    poles.instanceMatrix.needsUpdate = true;
    wires.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    const p = progressRef.current;
    groundMatRef.current?.color.lerpColors(GROUND_START, GROUND_END, p);
    ballastMatRef.current?.color.lerpColors(BALLAST_START, BALLAST_END, p);
    railMatRefA.current?.color.lerpColors(RAIL_START, RAIL_END, p);
    railMatRefB.current?.color.lerpColors(RAIL_START, RAIL_END, p);

    if (wireMatRef.current) {
      const wireOpacity = Math.min(Math.max((p - WIRE_FADE_START) / (WIRE_FADE_END - WIRE_FADE_START), 0), 1);
      wireMatRef.current.opacity = wireOpacity;
    }
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[60, TRACK_LENGTH + 20]} />
        <meshStandardMaterial
          ref={groundMatRef}
          color={GROUND_START}
          map={groundMap}
          roughnessMap={groundRoughMap}
          normalMap={groundNormalMap}
          normalScale={GROUND_RELIEF}
          roughness={0.95}
        />
      </mesh>

      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[2.6, 0.1, TRACK_LENGTH]} />
        <meshStandardMaterial ref={ballastMatRef} color={BALLAST_START} map={ballastMap} normalMap={ballastNormalMap} normalScale={BALLAST_RELIEF} roughness={0.95} />
      </mesh>

      <mesh position={[0.75, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.14, TRACK_LENGTH]} />
        <meshStandardMaterial ref={railMatRefA} color={RAIL_START} map={railMap} normalMap={railNormalMap} normalScale={RAIL_RELIEF} metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh position={[-0.75, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.12, 0.14, TRACK_LENGTH]} />
        <meshStandardMaterial ref={railMatRefB} color={RAIL_START} map={railMap} normalMap={railNormalMap} normalScale={RAIL_RELIEF} metalness={0.85} roughness={0.35} />
      </mesh>
      {/* Rail head highlight strip to sell a polished-steel reflection along the running surface */}
      <mesh position={[0.75, 0.208, 0]} receiveShadow>
        <boxGeometry args={[0.05, 0.01, TRACK_LENGTH]} />
        <meshStandardMaterial color="#dfe4e8" metalness={0.95} roughness={0.12} />
      </mesh>
      <mesh position={[-0.75, 0.208, 0]} receiveShadow>
        <boxGeometry args={[0.05, 0.01, TRACK_LENGTH]} />
        <meshStandardMaterial color="#dfe4e8" metalness={0.95} roughness={0.12} />
      </mesh>

      <instancedMesh ref={sleeperMeshRef} args={[undefined, undefined, sleeperCount]} receiveShadow>
        <boxGeometry args={[1.9, 0.12, 0.22]} />
        <meshStandardMaterial color="#3d2c1e" normalMap={sleeperNormalMap} normalScale={TIMBER_RELIEF} roughness={0.92} />
      </instancedMesh>

      <instancedMesh ref={poleMeshRef} args={[undefined, undefined, poleCount]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 4.2, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.6} />
      </instancedMesh>

      <instancedMesh ref={wireMeshRef} args={[undefined, undefined, Math.max(poleCount - 1, 1)]}>
        <cylinderGeometry args={[0.02, 0.02, POLE_SPACING, 6]} />
        <meshStandardMaterial ref={wireMatRef} color="#111111" metalness={0.8} roughness={0.3} transparent opacity={0} />
      </instancedMesh>
    </group>
  );
}
