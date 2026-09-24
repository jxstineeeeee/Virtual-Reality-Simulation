import type { NpcEra } from "../People/npcStyle";

/**
 * Platform benches, and the seats on them. Waiting passengers sit here until their train opens its
 * doors (see `PlatformCrowd`), so the geometry and the seating spots have to agree exactly — hence
 * both living in this one file.
 *
 * Coordinates are world space. The platform slab is centered at x=-4.4 spanning x -5.6..-3.2 with its
 * top at y=0.5; the benches stand against its back edge, facing the track (+X).
 */
export const BENCH_X = -5.28;
export const PLATFORM_TOP = 0.5;
/** Seat pad top, above the platform. Matches the cabin's cushion height so `Person`'s sit pose fits. */
const SEAT_H = 0.47;
const BENCH_LENGTH = 1.7;
/** Z of the two seats on a bench, relative to its center. */
export const BENCH_SEAT_OFFSETS = [-0.42, 0.42];

/**
 * Bench centers along the platform. Chosen to miss the station building (which overlaps the platform's
 * back half at z -5.1..-0.9), the standing and chatting spots in `Crowds`, and the walkers' lanes.
 */
export const BENCH_SPOTS: number[] = [3.0, 7.05, 10.2];

/** Painted timber and cast iron early on; powder-coated steel and pale slats once the railway modernizes. */
function palette(era: NpcEra) {
  const modern = era === "electric" || era === "modern";
  return modern ? { slat: "#b3aa9a", frame: "#7e868f", metal: 0.55, rough: 0.4 } : { slat: "#6a4a2c", frame: "#2f2a25", metal: 0.35, rough: 0.7 };
}

function BenchEnd({ z, frame, metal, rough }: { z: number; frame: string; metal: number; rough: number }) {
  return (
    <group position={[0, 0, z]}>
      {/* Front and back legs */}
      {[0.16, -0.2].map((lx) => (
        <mesh key={lx} position={[lx, SEAT_H / 2, 0]} castShadow>
          <boxGeometry args={[0.05, SEAT_H, 0.06]} />
          <meshStandardMaterial color={frame} metalness={metal} roughness={rough} />
        </mesh>
      ))}
      {/* Back post carrying the backrest, raked back a little */}
      <mesh position={[-0.26, SEAT_H + 0.23, 0]} rotation={[0, 0, 0.12]} castShadow>
        <boxGeometry args={[0.05, 0.48, 0.06]} />
        <meshStandardMaterial color={frame} metalness={metal} roughness={rough} />
      </mesh>
      {/* Armrest scroll */}
      <mesh position={[-0.02, SEAT_H + 0.2, 0]} castShadow>
        <boxGeometry args={[0.42, 0.045, 0.05]} />
        <meshStandardMaterial color={frame} metalness={metal} roughness={rough} />
      </mesh>
    </group>
  );
}

/** One bench at `z` along the platform, facing the track. */
export function PlatformBench({ z, era }: { z: number; era: NpcEra }) {
  const { slat, frame, metal, rough } = palette(era);
  return (
    <group position={[BENCH_X, PLATFORM_TOP, z]}>
      {/* Seat slats, running the length of the bench */}
      {[-0.17, 0, 0.17].map((x) => (
        <mesh key={x} position={[x, SEAT_H - 0.025, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.14, 0.05, BENCH_LENGTH]} />
          <meshStandardMaterial color={slat} roughness={0.75} />
        </mesh>
      ))}
      {/* Backrest slats, raked to match the posts */}
      {[0.16, 0.37].map((dy) => (
        <mesh key={dy} position={[-0.25 - dy * 0.12, SEAT_H + dy, 0]} rotation={[0, 0, 0.12]} castShadow>
          <boxGeometry args={[0.05, 0.14, BENCH_LENGTH]} />
          <meshStandardMaterial color={slat} roughness={0.75} />
        </mesh>
      ))}
      <BenchEnd z={-BENCH_LENGTH / 2 + 0.09} frame={frame} metal={metal} rough={rough} />
      <BenchEnd z={BENCH_LENGTH / 2 - 0.09} frame={frame} metal={metal} rough={rough} />
    </group>
  );
}
