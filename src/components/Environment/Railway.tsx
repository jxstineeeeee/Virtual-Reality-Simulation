import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  ballastAoTexture,
  ballastColorTexture,
  ballastNormalTexture,
  ballastRoughnessTexture,
  groundAoTexture,
  groundColorTexture,
  groundNormalTexture,
  groundRoughnessTexture,
  railColorTexture,
  railNormalTexture,
  woodAoTexture,
  woodGrainTexture,
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

/**
 * Ballast is not a kerb. It is a trapezoidal bed: level under the sleepers, then battered away to
 * the cess so the stone stays put under traffic. The flat box this replaces gave the track a hard
 * vertical edge running the length of every wide shot, which reads as a plinth the train stands on
 * rather than as ground it is bedded into — and the shoulder is the part of the bed the camera
 * actually sees from trackside.
 *
 * The crown stays at y = 0.10, exactly where the box top was, because the sleepers, the rails and
 * every wheel in the film are pinned to it.
 */
function ballastProfile(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-2.4, -0.02);
  shape.lineTo(2.4, -0.02);
  shape.lineTo(1.35, 0.1);
  shape.lineTo(-1.35, 0.1);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: TRACK_LENGTH, bevelEnabled: false });
  // Extrusion runs from z = 0, so the bed has to be pulled back to straddle the origin.
  geometry.translate(0, 0, -TRACK_LENGTH / 2);
  return geometry;
}

/**
 * Flat-bottom rail, as three boxes: a broad foot, a thin web, a head.
 *
 * It was one plain slab, which from the platform looks like bar stock laid on the sleepers. The
 * waisted profile is the shape everyone recognises without being able to name it, and it is what
 * puts a line of shadow under the head, which is most of how a rail is read at any distance. The
 * whole section is authored inside the old slab envelope (y 0.07 to 0.21) so nothing that rides on
 * these rails has to move.
 */
function Rail({ x, headRef, map, normalMap }: { x: number; headRef: React.Ref<THREE.MeshStandardMaterial>; map: THREE.Texture; normalMap: THREE.Texture }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.085, 0]} receiveShadow>
        <boxGeometry args={[0.16, 0.03, TRACK_LENGTH]} />
        <meshStandardMaterial color="#6d6257" map={map} normalMap={normalMap} normalScale={RAIL_RELIEF} metalness={0.8} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.05, 0.08, TRACK_LENGTH]} />
        <meshStandardMaterial color="#5e544a" metalness={0.75} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.195, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.13, 0.03, TRACK_LENGTH]} />
        <meshStandardMaterial ref={headRef} color={RAIL_START} map={map} normalMap={normalMap} normalScale={RAIL_RELIEF} metalness={0.85} roughness={0.35} />
      </mesh>
      {/* The running surface: burnished bright by the wheels, and the only mirror in the landscape. */}
      <mesh position={[0, 0.2125, 0]} receiveShadow>
        <boxGeometry args={[0.07, 0.008, TRACK_LENGTH]} />
        <meshStandardMaterial color="#dfe4e8" metalness={0.95} roughness={0.1} />
      </mesh>
    </group>
  );
}

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

  const ballastGeometry = useMemo(() => ballastProfile(), []);

  const groundMap = useDetailMap(groundColorTexture, 10, 24);
  const groundRoughMap = useDetailMap(groundRoughnessTexture, 10, 24);
  const groundNormalMap = useDetailMap(groundNormalTexture, 10, 24);
  const groundAoMap = useDetailMap(groundAoTexture, 10, 24);
  // `ExtrudeGeometry` lays its side walls out in world units rather than 0..1, so the ballast bed is
  // tiled in repeats-per-metre rather than tiles-per-face like everything else here. At 0.6 the tile
  // is about 1.7 m across and carries ~25 stones, which puts them at roughly the 50 mm a screened
  // ballast actually is.
  const ballastMap = useDetailMap(ballastColorTexture, 0.6, 0.6);
  const ballastRoughMap = useDetailMap(ballastRoughnessTexture, 0.6, 0.6);
  const ballastNormalMap = useDetailMap(ballastNormalTexture, 0.6, 0.6);
  const ballastAoMap = useDetailMap(ballastAoTexture, 0.6, 0.6);
  const railMap = useDetailMap(railColorTexture, 1, 70);
  const railNormalMap = useDetailMap(railNormalTexture, 1, 70);
  const sleeperMap = useDetailMap(woodGrainTexture, 1, 1);
  const sleeperNormalMap = useDetailMap(woodNormalTexture, 1, 1);
  const sleeperAoMap = useDetailMap(woodAoTexture, 1, 1);

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
          aoMap={groundAoMap}
          aoMapIntensity={0.7}
          roughness={0.95}
        />
      </mesh>

      <mesh geometry={ballastGeometry} castShadow receiveShadow>
        <meshStandardMaterial
          ref={ballastMatRef}
          color={BALLAST_START}
          map={ballastMap}
          roughnessMap={ballastRoughMap}
          normalMap={ballastNormalMap}
          normalScale={BALLAST_RELIEF}
          aoMap={ballastAoMap}
          aoMapIntensity={0.9}
          roughness={0.95}
        />
      </mesh>

      <Rail x={0.75} headRef={railMatRefA} map={railMap} normalMap={railNormalMap} />
      <Rail x={-0.75} headRef={railMatRefB} map={railMap} normalMap={railNormalMap} />

      <instancedMesh ref={sleeperMeshRef} args={[undefined, undefined, sleeperCount]} receiveShadow>
        <boxGeometry args={[1.9, 0.12, 0.22]} />
        <meshStandardMaterial
          color="#6a5238"
          map={sleeperMap}
          normalMap={sleeperNormalMap}
          normalScale={TIMBER_RELIEF}
          aoMap={sleeperAoMap}
          aoMapIntensity={0.7}
          roughness={0.92}
        />
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
