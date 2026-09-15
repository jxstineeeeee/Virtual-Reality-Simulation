import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { fabricRoughnessTexture, floorRoughnessTexture } from "../../materials/presets";
import { CabinPassengers, type CabinPassengerConfig } from "../People/Crowds";

export interface CabinTheme {
  wall: string;
  floor: string;
  ceiling: string;
  seat: string;
  seatAccent: string;
  trim: string;
  glow: string;
}

/** Present-day electric-train interior: blue/grey fabric, steel trim. */
export const CLASSIC_THEME: CabinTheme = {
  wall: "#c9ced4",
  floor: "#4a4640",
  ceiling: "#eef1f4",
  seat: "#2f5f8a",
  seatAccent: "#1c3f5c",
  trim: "#173e6e",
  glow: "#fff3d6",
};

/** Modern high-speed train interior: white/red livery, brushed trim. */
export const MODERN_THEME: CabinTheme = {
  wall: "#eef0f2",
  floor: "#33383d",
  ceiling: "#ffffff",
  seat: "#d21e3c",
  seatAccent: "#8f1226",
  trim: "#c7ccd1",
  glow: "#eaf7ff",
};

/** Steam-era coach interior: varnished wood paneling, deep upholstery, brass fittings, oil-lamp glow. */
export const STEAM_THEME: CabinTheme = {
  wall: "#6b4a2c",
  floor: "#3a2a18",
  ceiling: "#8a6a42",
  seat: "#5c1f1f",
  seatAccent: "#3a1010",
  trim: "#c9a86a",
  glow: "#ffcf8a",
};

/** Diesel-era coach interior: utilitarian vinyl seating, painted steel trim, cool fluorescent light. */
export const DIESEL_THEME: CabinTheme = {
  wall: "#9a9488",
  floor: "#4a4640",
  ceiling: "#d8d4c8",
  seat: "#2f5c3a",
  seatAccent: "#1c3a24",
  trim: "#6a6a6a",
  glow: "#eaf2e8",
};

const WINDOW_Y = [0.95, 1.75] as const; // sill / head height
const HALF_W = 1.05;
const CEIL_Y = 2.15;

function SeatPair({ z, side, theme, fabricMap }: { z: number; side: 1 | -1; theme: CabinTheme; fabricMap: THREE.Texture }) {
  const x = side * 0.58;
  return (
    <group position={[x, 0, z]}>
      {/* Cushion — rounded so it reads as padded fabric rather than a foam block */}
      <RoundedBox args={[0.85, 0.14, 0.85]} radius={0.05} smoothness={2} position={[0, 0.42, 0]} castShadow>
        <meshStandardMaterial color={theme.seat} roughnessMap={fabricMap} roughness={0.95} />
      </RoundedBox>
      {/* Backrest */}
      <RoundedBox args={[0.85, 0.7, 0.14]} radius={0.06} smoothness={2} position={[0, 0.75, side * 0.36]} castShadow>
        <meshStandardMaterial color={theme.seat} roughnessMap={fabricMap} roughness={0.95} />
      </RoundedBox>
      {/* Headrest */}
      <RoundedBox args={[0.62, 0.28, 0.12]} radius={0.05} smoothness={2} position={[0, 1.18, side * 0.34]} castShadow>
        <meshStandardMaterial color={theme.seatAccent} roughnessMap={fabricMap} roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.48, side * -0.02]}>
        <boxGeometry args={[0.85, 0.08, 0.08]} />
        <meshStandardMaterial color={theme.seatAccent} roughness={0.6} />
      </mesh>
      {/* Steel/plastic armrest frame */}
      <mesh position={[side * 0.42, 0.55, 0]} castShadow>
        <boxGeometry args={[0.04, 0.5, 0.85]} />
        <meshPhysicalMaterial color={theme.trim} metalness={0.55} roughness={0.35} clearcoat={0.4} clearcoatRoughness={0.3} />
      </mesh>
      {/* Legs lifting the seat off the floor — closes the gap that made seats look like floating blocks */}
      <mesh position={[side * -0.35, 0.18, -0.3]}>
        <cylinderGeometry args={[0.025, 0.025, 0.36, 8]} />
        <meshStandardMaterial color={theme.trim} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[side * -0.35, 0.18, 0.3]}>
        <cylinderGeometry args={[0.025, 0.025, 0.36, 8]} />
        <meshStandardMaterial color={theme.trim} metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Overhead luggage rack: a slim glass-look shelf on steel brackets, running along both side walls. */
function LuggageRack({ side, length, theme }: { side: 1 | -1; length: number; theme: CabinTheme }) {
  const x = side * (HALF_W - 0.16);
  const y = WINDOW_Y[1] + 0.32;
  const brackets: number[] = [];
  for (let z = -length / 2 + 0.6; z < length / 2; z += 1.75) brackets.push(z);
  return (
    <group>
      <mesh position={[x, y, 0]}>
        <boxGeometry args={[0.26, 0.02, length - 0.6]} />
        <meshPhysicalMaterial color="#dfe7ea" roughness={0.15} metalness={0.05} transmission={0.4} thickness={0.05} />
      </mesh>
      {brackets.map((z) => (
        <mesh key={z} position={[x, y - 0.14, z]}>
          <boxGeometry args={[0.22, 0.26, 0.03]} />
          <meshStandardMaterial color={theme.trim} metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

interface CabinProps {
  theme?: CabinTheme;
  length?: number;
  seatSpan?: [number, number];
  /** 0 closed .. 1 fully open; animates the sliding vestibule doors at the -Z end. */
  doorOpenRef?: React.MutableRefObject<number>;
  /** Hide the far (+Z) end wall — used when a shot looks all the way down the aisle. */
  openFarEnd?: boolean;
  /** Seated (and optionally standing) NPC passengers, dressed for the given era. */
  passengers?: CabinPassengerConfig;
}

/**
 * A generic passenger-cabin shell: floor, ceiling, glazed side walls with mullions, bench seating
 * down an aisle, ceiling light strips, and animated sliding doors at one end. Reused by every
 * interior-POV scene (theme + door state differ per scene).
 */
export function Cabin({
  theme = CLASSIC_THEME,
  length = 8,
  seatSpan = [-3, 3],
  doorOpenRef,
  openFarEnd = false,
  passengers,
}: CabinProps) {
  const doorLRef = useRef<THREE.Mesh>(null);
  const doorRRef = useRef<THREE.Mesh>(null);
  const halfLen = length / 2;
  const doorZ = -halfLen;

  const [seatStart, seatEnd] = seatSpan;
  const seatRows = useMemo(() => {
    const rows: number[] = [];
    for (let z = seatStart; z <= seatEnd; z += 1.05) rows.push(z);
    return rows;
  }, [seatStart, seatEnd]);

  const mullionZs: number[] = [];
  for (let z = -halfLen + 0.8; z < halfLen - 0.8; z += 1.3) mullionZs.push(z);

  const lightZs: number[] = [];
  for (let z = -halfLen + 1; z < halfLen - 0.5; z += 1.8) lightZs.push(z);

  const fabricMap = useMemo(() => {
    const tex = fabricRoughnessTexture().clone();
    tex.repeat.set(2, 2);
    tex.needsUpdate = true;
    return tex;
  }, []);

  const floorMap = useMemo(() => {
    const tex = floorRoughnessTexture().clone();
    tex.repeat.set(1.5, length / 2);
    tex.needsUpdate = true;
    return tex;
  }, [length]);

  useFrame(() => {
    const open = doorOpenRef?.current ?? 0;
    const gap = THREE.MathUtils.lerp(0.02, 0.82, open);
    if (doorLRef.current) doorLRef.current.position.x = -0.42 - gap;
    if (doorRRef.current) doorRRef.current.position.x = 0.42 + gap;
  });

  return (
    <group>
      {/* Floor */}
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <boxGeometry args={[HALF_W * 2 + 0.1, 0.06, length]} />
        <meshStandardMaterial color={theme.floor} roughnessMap={floorMap} roughness={0.85} />
      </mesh>
      {/* Ceiling */}
      <mesh position={[0, CEIL_Y, 0]}>
        <boxGeometry args={[HALF_W * 2 + 0.1, 0.08, length]} />
        <meshStandardMaterial color={theme.ceiling} roughness={0.7} />
      </mesh>
      {/* Ceiling light channel (unlit backing strip) */}
      <mesh position={[0, CEIL_Y - 0.04, 0]}>
        <boxGeometry args={[0.5, 0.015, length - 0.6]} />
        <meshStandardMaterial color={theme.glow} emissive={theme.glow} emissiveIntensity={0.35} />
      </mesh>
      {/* Discrete light fixtures + real point lights, so window-light interaction (Step 6) and
          reflections on the glass/floor read correctly instead of relying on a flat emissive strip. */}
      {lightZs.map((z) => (
        <group key={z} position={[0, CEIL_Y - 0.06, z]}>
          <mesh>
            <boxGeometry args={[0.34, 0.02, 0.5]} />
            <meshStandardMaterial color={theme.glow} emissive={theme.glow} emissiveIntensity={1.6} toneMapped={false} />
          </mesh>
          <pointLight color={theme.glow} intensity={1.1} distance={2.6} decay={2} position={[0, -0.1, 0]} />
        </group>
      ))}

      {/* Side walls: skirt below window, header above, open glazed band between */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * HALF_W, WINDOW_Y[0] / 2, 0]}>
            <boxGeometry args={[0.05, WINDOW_Y[0], length]} />
            <meshStandardMaterial color={theme.wall} roughness={0.6} />
          </mesh>
          <mesh position={[side * HALF_W, WINDOW_Y[1] + (CEIL_Y - WINDOW_Y[1]) / 2, 0]}>
            <boxGeometry args={[0.05, CEIL_Y - WINDOW_Y[1], length]} />
            <meshStandardMaterial color={theme.wall} roughness={0.6} />
          </mesh>
          {/* Window glass: real transmission/reflection/tint rather than an open gap, so the outside
              reads as "through glass" even before any real footage is layered behind it (Step 3/4). */}
          <mesh position={[side * HALF_W, (WINDOW_Y[0] + WINDOW_Y[1]) / 2, 0]}>
            <boxGeometry args={[0.025, WINDOW_Y[1] - WINDOW_Y[0] - 0.04, length - 0.15]} />
            <meshPhysicalMaterial
              color="#dfeef5"
              transmission={0.94}
              thickness={0.03}
              ior={1.52}
              roughness={0.04}
              metalness={0}
              clearcoat={1}
              clearcoatRoughness={0.05}
              envMapIntensity={1.4}
              attenuationColor="#bcd8e0"
              attenuationDistance={2}
            />
          </mesh>
          {mullionZs.map((z) => (
            <mesh key={z} position={[side * HALF_W, (WINDOW_Y[0] + WINDOW_Y[1]) / 2, z]}>
              <boxGeometry args={[0.05, WINDOW_Y[1] - WINDOW_Y[0], 0.07]} />
              <meshStandardMaterial color={theme.trim} metalness={0.4} roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Near end wall (-Z): vestibule with sliding doors */}
      <mesh position={[-1.06 * HALF_W, 1.0, doorZ]}>
        <boxGeometry args={[0.62, 2.0, 0.06]} />
        <meshStandardMaterial color={theme.wall} roughness={0.6} />
      </mesh>
      <mesh position={[1.06 * HALF_W, 1.0, doorZ]}>
        <boxGeometry args={[0.62, 2.0, 0.06]} />
        <meshStandardMaterial color={theme.wall} roughness={0.6} />
      </mesh>
      <mesh position={[0, CEIL_Y - 0.15, doorZ]}>
        <boxGeometry args={[1.7, 0.3, 0.06]} />
        <meshStandardMaterial color={theme.wall} roughness={0.6} />
      </mesh>
      <mesh ref={doorLRef} position={[-0.44, 0.95, doorZ]}>
        <boxGeometry args={[0.85, 1.9, 0.05]} />
        <meshPhysicalMaterial color={theme.trim} roughness={0.2} metalness={0.3} clearcoat={0.6} />
      </mesh>
      <mesh ref={doorRRef} position={[0.44, 0.95, doorZ]}>
        <boxGeometry args={[0.85, 1.9, 0.05]} />
        <meshPhysicalMaterial color={theme.trim} roughness={0.2} metalness={0.3} clearcoat={0.6} />
      </mesh>

      {/* Far end wall (+Z): leads to the next carriage */}
      {!openFarEnd && (
        <mesh position={[0, 1.05, halfLen]}>
          <boxGeometry args={[HALF_W * 2 + 0.1, 2.1, 0.06]} />
          <meshStandardMaterial color={theme.wall} roughness={0.6} />
        </mesh>
      )}

      {seatRows.map((z, i) => (
        <group key={z}>
          <SeatPair z={z} side={-1} theme={theme} fabricMap={fabricMap} />
          {i % 2 === 0 && <SeatPair z={z} side={1} theme={theme} fabricMap={fabricMap} />}
        </group>
      ))}

      {passengers && <CabinPassengers {...passengers} seatRows={seatRows} poleZ={doorZ + 0.55} />}

      <LuggageRack side={-1} length={length} theme={theme} />
      <LuggageRack side={1} length={length} theme={theme} />

      {/* Grab poles near the doorway */}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 1.1, doorZ + 0.55]}>
          <cylinderGeometry args={[0.025, 0.025, 2.1, 8]} />
          <meshStandardMaterial color={theme.trim} metalness={0.7} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}
