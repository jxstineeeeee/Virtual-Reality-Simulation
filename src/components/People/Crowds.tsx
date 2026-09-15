import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { Person, type NpcActivity, type NpcMotion } from "./Person";
import { createRng, makeOutfit, pick, type NpcEra, type Outfit } from "./npcStyle";

/** Top surface of `Platform` (a 0.5m-tall slab centered at x=-4.4, spanning x -5.6..-3.2, z -9..13). */
const PLATFORM_Y = 0.5;
const STRIDE_LENGTH = 1.4;

/**
 * Hand-placed standing spots on the platform. Kept clear of the station building (which overlaps the
 * platform's back half at z -5.1..-0.9), the lamp posts (x -3.5 at z -6/2/10), and the canopy pillars
 * (x -3.6 at z -5/-3/-1), and in lanes that don't cross the two walkers' paths.
 */
const EDGE_SPOTS: [number, number][] = [
  [-3.75, -8],
  [-3.75, -6.8],
  [-3.75, -4.1],
  [-3.75, -2],
  [-3.75, 0.2],
  [-3.75, 3.2],
  [-3.75, 4.4],
  [-3.75, 6.8],
  [-3.75, 11.5],
];
const BACK_SPOTS: [number, number][] = [
  [-5.35, -8.4],
  [-5.35, 1.2],
  [-5.35, 8.6],
  [-5.35, 11.8],
];
/** Pairs of people facing each other in conversation, [x, z] of the first; the second stands 0.7m further along +Z. */
const CHAT_SPOTS: [number, number][] = [
  [-5.35, 4.8],
  [-5.35, -7.2],
];
const WALKERS = [
  { x: -4.25, zMin: -8, zMax: 12, speed: 1.15, offset: 0 },
  { x: -4.75, zMin: 0.4, zMax: 12, speed: 0.95, offset: 7 },
  { x: -4.25, zMin: -8, zMax: 12, speed: 1.3, offset: 21 },
];

function isNear(x: number, z: number, avoid: [number, number][], radius: number): boolean {
  return avoid.some(([ax, az]) => Math.hypot(ax - x, az - z) < radius);
}

function PlatformWalker({ outfit, x, zMin, zMax, speed, offset }: { outfit: Outfit; x: number; zMin: number; zMax: number; speed: number; offset: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const motion = useRef<NpcMotion>({ walk: 0, stride: 0 });
  const yaw = useRef(0);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const PAUSE = 2.5;
    const walkTime = (zMax - zMin) / speed;
    const cycle = 2 * (walkTime + PAUSE);
    const t = timelineStore.getElapsed() + offset;
    const u = ((t % cycle) + cycle) % cycle;

    let z: number;
    let heading: number;
    let walking: boolean;
    if (u < walkTime) {
      z = zMin + u * speed;
      heading = 0;
      walking = true;
    } else if (u < walkTime + PAUSE) {
      z = zMax;
      heading = Math.PI;
      walking = false;
    } else if (u < 2 * walkTime + PAUSE) {
      z = zMax - (u - walkTime - PAUSE) * speed;
      heading = Math.PI;
      walking = true;
    } else {
      z = zMin;
      heading = 0;
      walking = false;
    }

    const k = Math.min(1, delta * 5);
    motion.current.walk += ((walking ? 1 : 0) - motion.current.walk) * k;
    motion.current.stride = ((t * speed) / STRIDE_LENGTH) * Math.PI * 2;
    yaw.current += (heading - yaw.current) * Math.min(1, delta * 3.5);
    group.position.set(x, PLATFORM_Y, z);
    group.rotation.y = yaw.current;
  });

  return (
    <group ref={groupRef}>
      <Person outfit={outfit} motionRef={motion} phase={offset} />
    </group>
  );
}

interface PlatformCrowdProps {
  era: NpcEra;
  seed?: number;
  /** 0..1 fraction of the standing spots that get filled. */
  density?: number;
  /** Camera positions ([x, z]) to keep clear, so the first-person viewer never stands inside an NPC. */
  avoid?: [number, number][];
  /** Some platform-edge NPCs wave — used as the train pulls away. */
  waving?: boolean;
}

/** Waiting, chatting, and walking passengers on the station platform, dressed for `era`. */
export function PlatformCrowd({ era, seed = 1, density = 0.75, avoid = [], waving = false }: PlatformCrowdProps) {
  const people = useMemo(() => {
    const rng = createRng(seed);
    const standing: { key: string; outfit: Outfit; pos: [number, number, number]; yaw: number; activity: NpcActivity; phase: number }[] = [];
    const idleActs: NpcActivity[] = era === "modern" ? ["phone", "phone", "idle"] : era === "electric" ? ["idle", "idle", "phone"] : ["idle"];

    EDGE_SPOTS.forEach(([x, z], i) => {
      if (rng() > density || isNear(x, z, avoid, 1.3)) return;
      // Facing the track, turned a little up or down the line as if watching for the train.
      const activity: NpcActivity = waving && rng() < 0.6 ? "wave" : pick(rng, idleActs);
      standing.push({ key: `e${i}`, outfit: makeOutfit(era, rng), pos: [x, PLATFORM_Y, z], yaw: Math.PI / 2 + (rng() - 0.5) * 0.9, activity, phase: rng() * 40 });
    });
    BACK_SPOTS.forEach(([x, z], i) => {
      if (rng() > density || isNear(x, z, avoid, 1.3)) return;
      standing.push({ key: `b${i}`, outfit: makeOutfit(era, rng), pos: [x, PLATFORM_Y, z], yaw: Math.PI / 2 + (rng() - 0.5) * 1.2, activity: pick(rng, idleActs), phase: rng() * 40 });
    });
    CHAT_SPOTS.forEach(([x, z], i) => {
      if (rng() > density || isNear(x, z, avoid, 1.6)) return;
      standing.push({ key: `c${i}a`, outfit: makeOutfit(era, rng), pos: [x, PLATFORM_Y, z], yaw: 0.25, activity: "chat", phase: rng() * 40 });
      standing.push({ key: `c${i}b`, outfit: makeOutfit(era, rng), pos: [x, PLATFORM_Y, z + 0.7], yaw: Math.PI + 0.25, activity: "idle", phase: rng() * 40 });
    });

    const walkers = WALKERS.filter((w, i) => (i < 2 || density > 0.7) && !avoid.some(([ax, az]) => Math.abs(ax - w.x) < 0.8 && az > w.zMin - 1 && az < w.zMax + 1)).map(
      (w, i) => ({ ...w, key: `w${i}`, outfit: makeOutfit(era, rng) }),
    );
    return { standing, walkers };
  }, [era, seed, density, avoid, waving]);

  return (
    <group>
      {people.standing.map((p) => (
        <Person key={p.key} outfit={p.outfit} position={p.pos} yaw={p.yaw} activity={p.activity} phase={p.phase} />
      ))}
      {people.walkers.map((w) => (
        <PlatformWalker key={w.key} outfit={w.outfit} x={w.x} zMin={w.zMin} zMax={w.zMax} speed={w.speed} offset={w.offset} />
      ))}
    </group>
  );
}

export interface CabinPassengerConfig {
  era: NpcEra;
  seed?: number;
  /** 0..1 fraction of seats occupied. */
  density?: number;
  /** Cabin-local Z values where the first-person camera sits/stands on the aisle (+X) side — those
   * aisle seats are always left empty so the viewer never shares a seat with an NPC. */
  avoidZ?: number[];
  /** Add one standing passenger holding the doorway grab pole (busier, later-era trains). */
  standing?: boolean;
}

interface CabinPassengersProps extends CabinPassengerConfig {
  seatRows: number[];
  poleZ: number;
}

/** Seated passengers for `Cabin`'s bench layout: every row has a -X seat, even rows also a +X seat. */
export function CabinPassengers({ era, seed = 1, density = 0.55, avoidZ = [], standing = false, seatRows, poleZ }: CabinPassengersProps) {
  const people = useMemo(() => {
    const rng = createRng(seed);
    const seatedActs: NpcActivity[] =
      era === "modern" ? ["phone", "phone", "lookWindow", "idle"] : era === "electric" ? ["newspaper", "lookWindow", "idle", "phone"] : ["newspaper", "lookWindow", "idle", "idle"];
    const list: { key: string; outfit: Outfit; pos: [number, number, number]; yaw: number; activity: NpcActivity; phase: number; pose: "sit" | "stand" }[] = [];

    seatRows.forEach((z, i) => {
      for (const side of [-1, 1] as const) {
        if (side === 1 && i % 2 !== 0) continue;
        // Draw before any skip so each seat's outfit stays stable when avoidZ differs between scenes.
        const roll = rng();
        const outfit = makeOutfit(era, rng);
        const activity = pick(rng, seatedActs);
        if (roll > density) continue;
        if (side === 1 && avoidZ.some((az) => Math.abs(az - z) < 1.0)) continue;
        if (side === 1 && standing && Math.abs(poleZ - z) < 0.9) continue;
        // -X seats face +Z (backrest toward -Z), +X seats face -Z — see `SeatPair`.
        const facing = side === -1 ? 1 : -1;
        list.push({ key: `s${i}${side}`, outfit, pos: [side * 0.58, 0, z + facing * 0.02], yaw: side === -1 ? 0 : Math.PI, activity, phase: i * 3.7 + side * 11, pose: "sit" });
      }
    });

    if (standing) {
      // Facing the +X window, right hand up on the +X grab pole; the right arm sits 0.21m toward -Z at this yaw.
      list.push({ key: "pole", outfit: makeOutfit(era, rng), pos: [0.08, 0, poleZ + 0.21], yaw: Math.PI / 2, activity: "holdPole", phase: 5, pose: "stand" });
    }
    return list;
  }, [era, seed, density, avoidZ, standing, seatRows, poleZ]);

  return (
    <group>
      {people.map((p) => (
        <Person key={p.key} outfit={p.outfit} position={p.pos} yaw={p.yaw} activity={p.activity} phase={p.phase} pose={p.pose} />
      ))}
    </group>
  );
}
