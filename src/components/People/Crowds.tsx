import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { clamp01, smootherstep } from "../../timeline/timeline";
import { DOOR_STOP_Z } from "../Train/trainDoors";
import { BENCH_SEAT_OFFSETS, BENCH_SPOTS, BENCH_X, PlatformBench } from "../Environment/PlatformBench";
import { applyOpacity } from "../../utils/fade";
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

/** How long a walker stands at each end of its beat before turning back. */
const WALKER_PAUSE = 2.5;
/** Seconds of that pause spent actually pivoting, and seconds spent easing in and out of the stride. */
const TURN_SECONDS = 1.6;
const GAIT_RAMP = 0.5;

function PlatformWalker({ outfit, x, zMin, zMax, speed, offset }: { outfit: Outfit; x: number; zMin: number; zMax: number; speed: number; offset: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const motion = useRef<NpcMotion>({ walk: 0, stride: 0 });

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const walkTime = (zMax - zMin) / speed;
    const cycle = 2 * (walkTime + WALKER_PAUSE);
    const t = timelineStore.getElapsed() + offset;
    const laps = Math.floor(t / cycle);
    const u = t - laps * cycle;

    // Position, heading and gait are all closed-form functions of `u` rather than integrated frame to
    // frame: identical at any frame rate, and still correct when the timeline is scrubbed or paused.
    let z: number;
    // Metres actually covered, which is what the stride is measured in — a walker standing at the end
    // of its beat stops advancing its gait instead of running on the spot.
    let travelled: number;
    if (u < walkTime) {
      travelled = u * speed;
      z = zMin + travelled;
    } else if (u < walkTime + WALKER_PAUSE) {
      travelled = walkTime * speed;
      z = zMax;
    } else if (u < 2 * walkTime + WALKER_PAUSE) {
      travelled = (walkTime + (u - walkTime - WALKER_PAUSE)) * speed;
      z = zMax - (u - walkTime - WALKER_PAUSE) * speed;
    } else {
      travelled = 2 * walkTime * speed;
      z = zMin;
    }

    // Eased in and out of each stop instead of lerped toward a target, so the legs settle and pick up
    // at the same rate however long the frame was.
    const startRamp = smootherstep(u / GAIT_RAMP);
    const toStop = smootherstep((walkTime - u) / GAIT_RAMP);
    const backOff = smootherstep((u - walkTime - WALKER_PAUSE) / GAIT_RAMP);
    const toEnd = smootherstep((2 * walkTime + WALKER_PAUSE - u) / GAIT_RAMP);
    motion.current.walk = Math.min(startRamp, toStop) + Math.min(backOff, toEnd);
    motion.current.stride = ((laps * 2 * walkTime * speed + travelled) / STRIDE_LENGTH) * Math.PI * 2;

    // The turn happens inside the pause and is undone over the second one, so yaw is back at 0 exactly
    // where the cycle wraps.
    const turnOut = smootherstep((u - walkTime - (WALKER_PAUSE - TURN_SECONDS) / 2) / TURN_SECONDS);
    const turnBack = smootherstep((u - 2 * walkTime - WALKER_PAUSE - (WALKER_PAUSE - TURN_SECONDS) / 2) / TURN_SECONDS);
    group.position.set(x, PLATFORM_Y, z);
    group.rotation.y = Math.PI * (turnOut - turnBack);
  });

  return (
    <group ref={groupRef}>
      <Person outfit={outfit} motionRef={motion} phase={offset} />
    </group>
  );
}

/** Lane the boarding queue walks down — clear of the benches behind it and the platform edge ahead. */
const BOARD_LANE_X = -4.3;
/** Where a boarder steps off the platform into the train doorway and out of shot. */
const BOARD_EDGE_X = -3.5;
/** Seconds to come up off the bench, and how far forward standing up carries them. */
const RISE_SECONDS = 1.2;
const RISE_STEP = 0.38;
const BOARD_SPEED = 1.1;

interface BenchWaiterProps {
  outfit: Outfit;
  activity: NpcActivity;
  seatZ: number;
  phase: number;
  /** Absolute clock time the train opens its doors. Undefined: this one is not going anywhere. */
  boardAt?: number;
  /** World Z of that door... */
  doorZ: number;
  /** ...and how far back down the queue behind it this one joins, so they do not all stack up. */
  queueZ: number;
  /** Staggered so a benchful of people do not all stand up on the same frame. */
  delay: number;
}

/**
 * Someone waiting for a train on a platform bench. They sit — genuinely still, the pose held rather
 * than played — until `boardAt`, then stand up, walk down the platform to the open door and step out
 * of shot through it. Every value below is a function of the timeline clock, so the whole beat
 * scrubs and pauses with the rest of the film.
 */
function BenchWaiter({ outfit, activity, seatZ, phase, boardAt, doorZ, queueZ, delay }: BenchWaiterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const motion = useRef<NpcMotion>({ walk: 0, stride: 0, sit: 1 });
  const yaw = useRef(Math.PI / 2);
  /** Last opacity written, so the fade only touches materials on the frames it actually changes. */
  const fade = useRef(1);

  // Bench -> out into the walking lane -> along it to the door -> across to the doorway.
  const path = useMemo<[number, number][]>(
    () => [
      [BENCH_X, seatZ],
      [BOARD_LANE_X, seatZ],
      [BOARD_LANE_X, doorZ + queueZ],
      [BOARD_LANE_X + 0.35, doorZ],
      [BOARD_EDGE_X, doorZ],
    ],
    [seatZ, doorZ, queueZ],
  );
  /** Cumulative length of the path at the end of each leg. */
  const legs = useMemo(() => {
    const out: number[] = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      out.push(total);
    }
    return out;
  }, [path]);

  /** The point `d` metres along the path, clamped to its ends. */
  const at = (d: number): [number, number] => {
    if (d <= 0) return path[0];
    for (let i = 0; i < legs.length; i++) {
      if (d > legs[i]) continue;
      const prev = i === 0 ? 0 : legs[i - 1];
      const f = (d - prev) / Math.max(legs[i] - prev, 1e-4);
      const a = path[i];
      const b = path[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    return path[path.length - 1];
  };

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    if (boardAt === undefined) {
      group.position.set(BENCH_X, PLATFORM_Y, seatZ);
      group.rotation.y = Math.PI / 2;
      motion.current.sit = 1;
      motion.current.walk = 0;
      return;
    }

    const total = legs[legs.length - 1];
    const t = timelineStore.getElapsed() - (boardAt + delay);
    const rise = smootherstep(clamp01(t / RISE_SECONDS));
    motion.current.sit = 1 - rise;
    // Standing up already carries them a step clear of the bench; the walk picks up from there.
    const dist = Math.min(RISE_STEP * rise + Math.max(t - RISE_SECONDS, 0) * BOARD_SPEED, total);
    motion.current.walk = smootherstep(clamp01((t - RISE_SECONDS) / GAIT_RAMP));
    motion.current.stride = (dist / STRIDE_LENGTH) * Math.PI * 2;

    const [x, z] = at(dist);
    group.position.set(x, PLATFORM_Y, z);
    // Aimed at a point further up the path rather than at the next corner, so the turns round
    // themselves off instead of snapping the moment a corner is passed.
    const [ax, az] = at(dist + 0.7);
    if (Math.hypot(ax - x, az - z) > 0.02) yaw.current = Math.atan2(ax - x, az - z);
    group.rotation.y = yaw.current;

    // Through the door: faded out over the last stretch rather than popped away. Only written when it
    // moves, so a waiter who never reaches the door never has transparency forced on their materials.
    const opacity = 1 - clamp01((dist - (total - 0.8)) / 0.7);
    if (opacity !== fade.current) {
      applyOpacity(group, opacity);
      fade.current = opacity;
    }
  });

  return (
    <group ref={groupRef}>
      <Person outfit={outfit} pose="sit" activity={activity} motionRef={motion} phase={phase} />
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
  /**
   * Absolute clock time at which the train standing at this platform opens its doors. Until then the
   * people on the benches simply sit; from then on they get up, one after another, and walk down the
   * platform and in through the door. Leave it out and nobody boards — which is what the scenes where
   * the train is leaving, or only passing through, want.
   */
  boardAt?: number;
  /** World Z of that door, for the trains that do not stand at `DOOR_STOP_Z`. */
  boardDoorZ?: number;
}

/** Waiting, chatting, and walking passengers on the station platform, dressed for `era`. */
export function PlatformCrowd({ era, seed = 1, density = 0.75, avoid = [], waving = false, boardAt, boardDoorZ = DOOR_STOP_Z }: PlatformCrowdProps) {
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

    // Bench sitters. They queue up in the order they are drawn, each joining a little further back
    // down the platform and a beat later than the one before, so the door does not collect a pile.
    const sittingActs: NpcActivity[] = era === "modern" || era === "electric" ? ["phone", "idle", "newspaper"] : ["newspaper", "idle", "idle"];
    const sitting: { key: string; outfit: Outfit; seatZ: number; activity: NpcActivity; phase: number; queueZ: number; delay: number }[] = [];
    BENCH_SPOTS.forEach((z, i) => {
      BENCH_SEAT_OFFSETS.forEach((dz, j) => {
        const roll = rng();
        const outfit = makeOutfit(era, rng);
        const activity = pick(rng, sittingActs);
        if (roll > density * 0.85) return;
        const n = sitting.length;
        sitting.push({ key: `q${i}${j}`, outfit, seatZ: z + dz, activity, phase: rng() * 40, queueZ: n * 0.62, delay: 0.3 + n * 0.75 });
      });
    });

    return { standing, walkers, sitting };
  }, [era, seed, density, avoid, waving]);

  return (
    <group>
      {people.standing.map((p) => (
        <Person key={p.key} outfit={p.outfit} position={p.pos} yaw={p.yaw} activity={p.activity} phase={p.phase} />
      ))}
      {people.walkers.map((w) => (
        <PlatformWalker key={w.key} outfit={w.outfit} x={w.x} zMin={w.zMin} zMax={w.zMax} speed={w.speed} offset={w.offset} />
      ))}
      {BENCH_SPOTS.map((z) => (
        <PlatformBench key={z} z={z} era={era} />
      ))}
      {people.sitting.map((s) => (
        <BenchWaiter
          key={s.key}
          outfit={s.outfit}
          activity={s.activity}
          seatZ={s.seatZ}
          phase={s.phase}
          boardAt={boardAt}
          doorZ={boardDoorZ}
          queueZ={s.queueZ}
          delay={s.delay}
        />
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
