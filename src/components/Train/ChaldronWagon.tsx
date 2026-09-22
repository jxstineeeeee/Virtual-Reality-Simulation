import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { coalNormalTexture, woodGrainTexture, woodNormalTexture } from "../../materials/presets";
import { useDetailMap } from "../../materials/useDetailMap";
import { WAGGONWAY_HALF_GAUGE } from "../Environment/Waggonway";
import { Lantern } from "../Environment/MineWorkings";

/** Wheelbase, so the two axles sit where the sleepers do rather than at arbitrary points. */
const AXLE_Z = [-0.72, 0.72];
const WHEEL_RADIUS = 0.34;
/** Top of the wagon floor — the load sits on this and the camera reads the heap against it. */
const BED_Y = 0.62;
/** Coal breaks along sharp faces and is faintly lustrous; sawn oak just has grain. */
const COAL_RELIEF = new THREE.Vector2(1.4, 1.4);
const PLANK_RELIEF = new THREE.Vector2(0.9, 0.9);

interface ChaldronWagonProps {
  /** Metres travelled, used to roll the wheels the exact distance the wagon has actually moved. */
  distanceRef?: React.MutableRefObject<number>;
  /** 0 = empty, 1 = heaped over the sides. */
  load?: number;
  /** Hang a lamp on the headstock, as a wagon being worked after dark would carry. */
  lamp?: boolean;
}

/** One coal wagon: planked oak body on iron-shod wheels, heaped with coal that shifts as it rolls. */
export function ChaldronWagon({ distanceRef, load = 1, lamp = false }: ChaldronWagonProps) {
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const bodyRef = useRef<THREE.Group>(null);

  const plankMap = useDetailMap(woodGrainTexture, 2, 1);
  const plankNormalMap = useDetailMap(woodNormalTexture, 2, 1);
  const coalNormalMap = useDetailMap(coalNormalTexture, 1, 1);

  // Coal is a heap of broken lumps, not a smooth mound — a fixed scatter beats a random one here
  // because the same wagon is on screen for the whole scene and must not reshuffle between frames.
  const lumps = useMemo(() => {
    const items: { pos: [number, number, number]; scale: number; rot: [number, number, number] }[] = [];
    for (let i = 0; i < 42; i++) {
      const u = Math.sin(i * 12.9898) * 43758.5453;
      const r1 = u - Math.floor(u);
      const v = Math.sin(i * 78.233) * 12345.6789;
      const r2 = v - Math.floor(v);
      const w = Math.sin(i * 39.425) * 9876.54321;
      const r3 = w - Math.floor(w);
      const x = (r1 - 0.5) * 0.92;
      const z = (r2 - 0.5) * 1.9;
      // Heaped highest down the centreline, tapering to the sides the way tipped coal settles.
      const mound = (1 - Math.abs(x) / 0.55) * (1 - Math.abs(z) / 1.15);
      items.push({
        pos: [x, Math.max(mound, 0) * 0.22 + r3 * 0.05, z],
        scale: 0.07 + r3 * 0.09,
        rot: [r1 * 6.28, r2 * 6.28, r3 * 6.28],
      });
    }
    return items;
  }, []);

  useFrame(() => {
    const distance = distanceRef?.current ?? 0;
    const angle = distance / WHEEL_RADIUS;
    for (const wheel of wheelRefs.current) if (wheel) wheel.rotation.x = angle;
    if (bodyRef.current) {
      // Unsprung timber on hand-laid rail: the body pitches and rolls over every joint it crosses.
      bodyRef.current.rotation.x = Math.sin(distance * 5.5) * 0.012;
      bodyRef.current.rotation.z = Math.sin(distance * 3.1 + 1.3) * 0.016;
      bodyRef.current.position.y = Math.abs(Math.sin(distance * 7.9)) * 0.008;
    }
  });

  return (
    <group>
      <group ref={bodyRef}>
        {/* Underframe */}
        <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.28, 0.14, 2.3]} />
          <meshStandardMaterial color="#3f2f1e" roughness={0.94} />
        </mesh>
        {/* Body: sides raked outward, the way a chaldron wagon flares toward the top */}
        {([-1, 1] as const).map((side) => (
          <mesh key={side} position={[side * 0.64, BED_Y + 0.28, 0]} rotation={[0, 0, side * -0.1]} castShadow receiveShadow>
            <boxGeometry args={[0.07, 0.62, 2.24]} />
            <meshStandardMaterial color="#4e3a24" map={plankMap} normalMap={plankNormalMap} normalScale={PLANK_RELIEF} roughness={0.92} />
          </mesh>
        ))}
        {([-1, 1] as const).map((end) => (
          <mesh key={end} position={[0, BED_Y + 0.28, end * 1.12]} rotation={[end * 0.1, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.32, 0.62, 0.07]} />
            <meshStandardMaterial color="#4e3a24" map={plankMap} normalMap={plankNormalMap} normalScale={PLANK_RELIEF} roughness={0.92} />
          </mesh>
        ))}
        <mesh position={[0, BED_Y, 0]} receiveShadow>
          <boxGeometry args={[1.24, 0.06, 2.2]} />
          <meshStandardMaterial color="#2f2418" roughness={0.95} />
        </mesh>

        {/* Iron bands strapping the body together */}
        {[-0.7, 0, 0.7].map((z) => (
          <mesh key={z} position={[0, BED_Y + 0.3, z]}>
            <boxGeometry args={[1.4, 0.05, 0.04]} />
            <meshStandardMaterial color="#42392f" metalness={0.72} roughness={0.55} />
          </mesh>
        ))}

        {/* The load */}
        {load > 0 &&
          lumps.map((lump, i) => (
            <mesh key={i} position={[lump.pos[0], BED_Y + 0.08 + lump.pos[1] * load, lump.pos[2]]} rotation={lump.rot} scale={lump.scale} castShadow>
              <dodecahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={i % 3 === 0 ? "#16161a" : "#0f1013"}
                normalMap={coalNormalMap}
                normalScale={COAL_RELIEF}
                roughness={0.58}
                metalness={0.16}
              />
            </mesh>
          ))}

        {/* Headstock, draw hook and the chain the horse is hitched to */}
        <mesh position={[0, 0.5, -1.2]} castShadow>
          <boxGeometry args={[1.34, 0.18, 0.12]} />
          <meshStandardMaterial color="#3f2f1e" roughness={0.94} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.5 - i * 0.012, -1.32 - i * 0.17]} rotation={[0, i % 2 === 0 ? 0 : Math.PI / 2, Math.PI / 2]}>
            <torusGeometry args={[0.055, 0.016, 5, 10]} />
            <meshStandardMaterial color="#3d352c" metalness={0.75} roughness={0.5} />
          </mesh>
        ))}

        {lamp && <Lantern position={[0.5, 0.92, -1.2]} intensity={0.9} seed={1.7} />}
      </group>

      {/* Wheels: iron tyre shrunk onto a spoked wooden wheel, running on the oak rail */}
      {AXLE_Z.map((z, i) =>
        ([-1, 1] as const).map((side) => (
          <group key={`${z}${side}`} ref={(el) => (wheelRefs.current[i * 2 + (side > 0 ? 1 : 0)] = el)} position={[side * WAGGONWAY_HALF_GAUGE, WHEEL_RADIUS, z]} rotation={[0, 0, Math.PI / 2]}>
            <mesh castShadow>
              <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.09, 16]} />
              <meshStandardMaterial color="#3d352c" metalness={0.7} roughness={0.55} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[WHEEL_RADIUS - 0.05, WHEEL_RADIUS - 0.05, 0.07, 16]} />
              <meshStandardMaterial color="#54402a" roughness={0.9} />
            </mesh>
            {/* Flange on the inside face — how a plateway wagon is kept on a rail with no flange of its own */}
            <mesh position={[side * -0.06, 0, 0]}>
              <cylinderGeometry args={[WHEEL_RADIUS + 0.05, WHEEL_RADIUS + 0.05, 0.03, 16]} />
              <meshStandardMaterial color="#3d352c" metalness={0.7} roughness={0.55} />
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((s) => (
              <mesh key={s} rotation={[0, (s * Math.PI) / 3, 0]}>
                <boxGeometry args={[WHEEL_RADIUS * 1.8, 0.05, 0.05]} />
                <meshStandardMaterial color="#54402a" roughness={0.9} />
              </mesh>
            ))}
            <mesh>
              <cylinderGeometry args={[0.07, 0.07, 0.14, 10]} />
              <meshStandardMaterial color="#3d352c" metalness={0.7} roughness={0.5} />
            </mesh>
          </group>
        )),
      )}

      {/* Axles */}
      {AXLE_Z.map((z) => (
        <mesh key={z} position={[0, WHEEL_RADIUS, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, WAGGONWAY_HALF_GAUGE * 2, 8]} />
          <meshStandardMaterial color="#3d352c" metalness={0.7} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}
