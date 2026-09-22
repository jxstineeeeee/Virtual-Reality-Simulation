import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";

/**
 * The same "infinite conveyor" trick `ScrollField` uses, but for props that have to be real groups
 * rather than instances of one geometry — a turbine whose rotor turns, a solar array that tracks.
 * Counts are kept small for exactly that reason: these are the few things instancing cannot carry.
 */
function useScrollZ(count: number, cycleLength: number, xRange: [number, number], seed: number) {
  return useMemo(() => {
    const rng = (i: number) => {
      const v = Math.sin((i + seed) * 127.1) * 43758.5453;
      return v - Math.floor(v);
    };
    return Array.from({ length: count }, (_, i) => ({
      x: THREE.MathUtils.lerp(xRange[0], xRange[1], rng(i)),
      zSeed: rng(i + 100) * cycleLength,
      scale: 0.8 + rng(i + 200) * 0.5,
      phase: rng(i + 300) * Math.PI * 2,
    }));
  }, [count, cycleLength, xRange, seed]);
}

function scrollZ(zSeed: number, traveled: number, cycleLength: number): number {
  const half = cycleLength / 2;
  let z = (zSeed - traveled) % cycleLength;
  if (z < -half) z += cycleLength;
  if (z > half) z -= cycleLength;
  return z;
}

interface FieldProps {
  distanceRef: React.MutableRefObject<number>;
  count?: number;
  side?: "both" | "left" | "right";
}

function ranges(side: "both" | "left" | "right", near: number, far: number): [number, number][] {
  const out: [number, number][] = [];
  if (side !== "right") out.push([-far, -near]);
  if (side !== "left") out.push([near, far]);
  return out;
}

/** One three-bladed turbine: tapered tower, nacelle, and a rotor that actually turns. */
function Turbine({ phase }: { phase: number }) {
  const rotorRef = useRef<THREE.Group>(null);

  useFrame(() => {
    // Large turbines are slow — around 12 rpm, not the blur a small prop would give.
    if (rotorRef.current) rotorRef.current.rotation.z = timelineStore.getElapsed() * 1.25 + phase;
  });

  return (
    <group>
      <mesh position={[0, 5, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.42, 10, 10]} />
        <meshStandardMaterial color="#eef1f3" roughness={0.65} />
      </mesh>
      <mesh position={[0, 10.1, 0.35]} castShadow>
        <capsuleGeometry args={[0.36, 0.7, 4, 10]} />
        <meshStandardMaterial color="#e6eaed" roughness={0.6} />
      </mesh>
      <group ref={rotorRef} position={[0, 10.1, 0.85]}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.16, 0.2, 10]} />
          <meshStandardMaterial color="#dfe4e8" roughness={0.6} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]} position={[0, 0, 0]} castShadow>
            <boxGeometry args={[0.32, 8.4, 0.08]} />
            <meshStandardMaterial color="#f2f5f7" roughness={0.55} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** A wind farm on the skyline, turning at the pace real turbines turn. */
export function WindFarm({ distanceRef, count = 5, side = "both" }: FieldProps) {
  return (
    <>
      {ranges(side, 30, 70).map((xRange, i) => (
        <WindRow key={xRange.join()} distanceRef={distanceRef} count={count} xRange={xRange} seed={i * 17} />
      ))}
    </>
  );
}

function WindRow({ distanceRef, count, xRange, seed }: { distanceRef: React.MutableRefObject<number>; count: number; xRange: [number, number]; seed: number }) {
  const CYCLE = 190;
  const layout = useScrollZ(count, CYCLE, xRange, seed);
  const groups = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    // Far enough back to sit behind everything else, so they parallax slowly.
    const traveled = distanceRef.current * 0.3;
    for (let i = 0; i < layout.length; i++) {
      const g = groups.current[i];
      if (g) g.position.z = scrollZ(layout[i].zSeed, traveled, CYCLE);
    }
  });

  return (
    <>
      {layout.map((t, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} position={[t.x, 0, 0]} scale={t.scale}>
          <Turbine phase={t.phase} />
        </group>
      ))}
    </>
  );
}

/** Rows of tilted photovoltaic panels on the embankment side, catching the low sun. */
export function SolarField({ distanceRef, count = 7, side = "both" }: FieldProps) {
  return (
    <>
      {ranges(side, 10, 26).map((xRange, i) => (
        <SolarRow key={xRange.join()} distanceRef={distanceRef} count={count} xRange={xRange} seed={i * 31 + 5} />
      ))}
    </>
  );
}

function SolarRow({ distanceRef, count, xRange, seed }: { distanceRef: React.MutableRefObject<number>; count: number; xRange: [number, number]; seed: number }) {
  const CYCLE = 95;
  const layout = useScrollZ(count, CYCLE, xRange, seed);
  const groups = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    const traveled = distanceRef.current;
    for (let i = 0; i < layout.length; i++) {
      const g = groups.current[i];
      if (g) g.position.z = scrollZ(layout[i].zSeed, traveled, CYCLE);
    }
  });

  return (
    <>
      {layout.map((t, i) => (
        <group key={i} ref={(el) => (groups.current[i] = el)} position={[t.x, 0, 0]} scale={t.scale}>
          {[-2.2, 0, 2.2].map((dz) => (
            <group key={dz} position={[0, 0, dz]}>
              <mesh position={[0, 0.72, 0]} rotation={[-0.5, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[3.4, 1.9, 0.06]} />
                <meshPhysicalMaterial color="#111b33" metalness={0.35} roughness={0.14} clearcoat={0.9} clearcoatRoughness={0.08} />
              </mesh>
              {[-1.3, 1.3].map((dx) => (
                <mesh key={dx} position={[dx, 0.3, 0.2]}>
                  <cylinderGeometry args={[0.05, 0.05, 0.6, 6]} />
                  <meshStandardMaterial color="#8d939a" metalness={0.5} roughness={0.5} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

/**
 * The city the last train runs into: blocks with planted roofs, panelled south faces and a warm
 * window glow — near-future building stock rather than anything speculative. One instanced mesh per
 * layer keeps it as cheap as the plain `BuildingField` it stands in for.
 */
export function GreenCity({ distanceRef, side = "both", density = 1 }: FieldProps & { density?: number }) {
  return (
    <>
      {ranges(side, 9, 32).map((xRange, i) => (
        <GreenCityRow key={xRange.join()} distanceRef={distanceRef} count={Math.round(11 * density)} xRange={xRange} seed={i * 41 + 3} />
      ))}
    </>
  );
}

function GreenCityRow({ distanceRef, count, xRange, seed }: { distanceRef: React.MutableRefObject<number>; count: number; xRange: [number, number]; seed: number }) {
  const CYCLE = 105;
  const layout = useScrollZ(count, CYCLE, xRange, seed);
  const groups = useRef<(THREE.Group | null)[]>([]);

  useFrame(() => {
    const traveled = distanceRef.current * 0.9;
    for (let i = 0; i < layout.length; i++) {
      const g = groups.current[i];
      if (g) g.position.z = scrollZ(layout[i].zSeed, traveled, CYCLE);
    }
  });

  return (
    <>
      {layout.map((t, i) => {
        const h = 3 + t.scale * 5;
        return (
          <group key={i} ref={(el) => (groups.current[i] = el)} position={[t.x, 0, 0]}>
            <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[4.2, h, 4.2]} />
              <meshStandardMaterial color="#8d95a0" roughness={0.75} />
            </mesh>
            {/* Lit window bands */}
            {[0.35, 0.6, 0.85].map((f) => (
              <mesh key={f} position={[0, h * f, 0]}>
                <boxGeometry args={[4.26, 0.5, 4.26]} />
                <meshStandardMaterial color="#2b3a4a" emissive="#ffd9a0" emissiveIntensity={0.45} roughness={0.2} metalness={0.2} />
              </mesh>
            ))}
            {/* Planted roof */}
            <mesh position={[0, h + 0.18, 0]} receiveShadow>
              <boxGeometry args={[4.3, 0.36, 4.3]} />
              <meshStandardMaterial color="#5c8a4a" roughness={0.95} />
            </mesh>
            {/* Panels on the sunward face */}
            <mesh position={[2.16, h * 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[h * 0.5, 0.05, 3]} />
              <meshPhysicalMaterial color="#132038" metalness={0.35} roughness={0.15} clearcoat={0.8} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
