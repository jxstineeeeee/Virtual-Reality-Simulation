import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Cabin, DIESEL_THEME, CLASSIC_THEME, MODERN_THEME, type CabinTheme } from "../components/Interior/Cabin";
import { GroundStrip, TreeField, MountainBackdrop } from "../components/Environment/Biomes";
import { Railway } from "../components/Environment/Railway";
import { Platform } from "../components/Environment/Platform";
import { Station } from "../components/Environment/Station";
import { Vegetation } from "../components/Environment/Vegetation";
import { TracksideProps } from "../components/Environment/TracksideProps";
import { SteamTrain } from "../components/Train/SteamTrain";
import { DieselTrain } from "../components/Train/DieselTrain";
import { ElectricTrain } from "../components/Train/ElectricTrain";
import { ModernTrain } from "../components/Train/ModernTrain";
import { TrainCarrier, type TrainMotionState } from "../components/Train/TrainCarrier";
import { BoardingDoorway } from "../components/Train/BoardingDoorway";
import { TRAIN_DOORS, DOOR_STOP_Z, trainRestZ, type DoorCue, type DoorState, type DoorTrain } from "../components/Train/trainDoors";
import { SteamEffect } from "../effects/SteamEffect";
import { DieselExhaustEffect } from "../effects/DieselExhaustEffect";
import { ElectricSparkEffect } from "../effects/ElectricSparkEffect";
import { SpeedLinesEffect } from "../effects/SpeedLinesEffect";
import { PlatformCrowd } from "../components/People/Crowds";
import { DepartureBoard } from "../components/Environment/SmartRail";
import type { NpcEra, TrainNpcEra } from "../components/People/npcStyle";
import { timelineStore } from "../state/timelineStore";
import { skyState } from "../state/skyState";
import { useQuality } from "../effects/renderQuality";
import { getSceneLocal, smootherstep, lerp, clamp01 } from "../timeline/timeline";
import { getEraAtTime, getGlobalProgress, ERAS, EVOLUTION_DURATION } from "../data/timeline";
import { applyOpacity } from "../utils/fade";
import { sampleShots, type Shot, type CameraShotResult } from "../components/Camera/shotUtils";

const [STEAM_ERA, DIESEL_ERA, ELECTRIC_ERA, , FINAL_ERA] = ERAS;

/** Length of a handoff that opens with stepping off the old train (handoffs 2 and 3). */
const EXIT_HANDOFF_SECONDS = 25;
/** Handoff 1 has no step-off beat (that already happened in `ExteriorRideScene`), so its beats run this much earlier. */
const NO_EXIT_OFFSET = -5;
const TRAIN_OFFSCREEN_Z = 60;
/** A ride brakes to a stop over this long before its exit handoff... */
const RIDE_BRAKE_SECONDS = 7;
/** ...and pulls away over this long after boarding. */
const RIDE_PULL_AWAY_SECONDS = 5;
/** Seconds before an exit handoff that the seated viewer gets up and walks to the cabin door. */
const RIDE_EXIT_WALK_SECONDS = 3;

interface Handoff {
  start: number;
  end: number;
  /** The train the viewer just rode, standing at the platform. */
  depart: DoorTrain;
  /** The next generation, which arrives and is boarded. */
  arrive: DoorTrain;
  /** Opens with the viewer stepping off `depart` through its door. */
  exit: boolean;
}

// Every generation runs the same loop: ride -> brake to a stop -> step off through the highlighted
// door -> that train departs -> the next one arrives -> board through its highlighted door. Handoff 1
// starts on the platform (the steam exit is the end of `ExteriorRideScene`); handoffs 2 and 3 are
// carved out of the tail of the diesel/electric windows.
const HANDOFFS: Handoff[] = [
  { start: STEAM_ERA.start, end: STEAM_ERA.end, depart: "steam", arrive: "diesel", exit: false },
  { start: DIESEL_ERA.end - EXIT_HANDOFF_SECONDS, end: DIESEL_ERA.end, depart: "diesel", arrive: "electric", exit: true },
  { start: ELECTRIC_ERA.end - EXIT_HANDOFF_SECONDS, end: ELECTRIC_ERA.end, depart: "electric", arrive: "modern", exit: true },
];
const [H1, H2, H3] = HANDOFFS;

/** Absolute local times of each beat within a handoff. */
function beats(h: Handoff) {
  const o = h.exit ? 0 : NO_EXIT_OFFSET;
  const s = h.start;
  return {
    exitHighlightEnd: s + 4.5,
    departDoorClose: s + 5.5,
    departStart: s + 6.5 + o,
    departEnd: s + 12 + o,
    arriveStart: s + 12.5 + o,
    arriveEnd: s + 18 + o,
    highlightStart: s + 17.5 + o,
    openStart: s + 18.5 + o,
    openEnd: s + 20.5 + o,
    highlightEnd: s + 23 + o,
  };
}

function handoffAt(local: number): Handoff | undefined {
  return HANDOFFS.find((h) => local >= h.start && local < h.end);
}

function inAnyHandoff(local: number): boolean {
  return handoffAt(local) !== undefined;
}

/** The standing train's door: open and lit while the viewer steps off, then shut before it leaves. */
function departDoorState(h: Handoff, local: number): DoorState {
  if (!h.exit) return { open: 0, highlight: 0 };
  const b = beats(h);
  return {
    open: 1 - smootherstep(local - b.departDoorClose),
    highlight: clamp01((local - h.start) / 0.4) * (1 - clamp01(local - b.exitHighlightEnd)),
  };
}

/** The arriving train's door: lights up as it stops, swings open, and stays open while the viewer boards. */
function arriveDoorState(h: Handoff, local: number): DoorState {
  const b = beats(h);
  return {
    open: smootherstep((local - b.openStart) / (b.openEnd - b.openStart)),
    highlight: clamp01(local - b.highlightStart) * (1 - clamp01(local - b.highlightEnd)),
  };
}

/** The ride cabin's end doors open as the stopped viewer walks up to them. */
function cabinExitDoorOpen(exitAt: number, local: number): number {
  return smootherstep((local - (exitAt - 2.4)) / 1.6);
}

function upcomingExit(local: number, lead: number): Handoff | undefined {
  return HANDOFFS.find((h) => h.exit && local >= h.start - lead && local < h.start);
}

function currentRideStart(local: number): number {
  let rideStart = H1.end;
  for (const h of HANDOFFS) if (local >= h.end) rideStart = h.end;
  return rideStart;
}

/** 0..1 how fast the ride is going: pulls away after boarding, brakes to a stop before each exit. */
function rideSpeedFactor(local: number): number {
  if (inAnyHandoff(local)) return 0;
  const pullAway = smootherstep((local - currentRideStart(local)) / RIDE_PULL_AWAY_SECONDS);
  const exit = upcomingExit(local, RIDE_BRAKE_SECONDS);
  const brake = exit ? 1 - smootherstep((local - (exit.start - RIDE_BRAKE_SECONDS)) / (RIDE_BRAKE_SECONDS - 2)) : 1;
  return pullAway * brake;
}

/** Engine/wheel speed for `AudioDriver`: follows the ride's braking and pulling away. */
export function evolutionAudioSpeed(local: number): number {
  const era = getEraAtTime(local);
  return inAnyHandoff(local) ? era.trainSpeed * 0.5 : era.trainSpeed * rideSpeedFactor(local);
}

/** Door-open (0..1) of whichever door the viewer is currently using — drives the door hiss in `AudioDriver`. */
export function evolutionDoorOpen(local: number): number {
  const h = handoffAt(local);
  if (h) return h.exit && local < beats(h).departDoorClose + 1 ? departDoorState(h, local).open : arriveDoorState(h, local).open;
  const exit = upcomingExit(local, RIDE_EXIT_WALK_SECONDS);
  return exit ? cabinExitDoorOpen(exit.start, local) : 0;
}

/** Which door prompt ("STEP OFF" / "BOARD") the on-screen cue should show right now. */
export function evolutionDoorCue(local: number): DoorCue | null {
  const h = handoffAt(local);
  if (!h) return null;
  if (h.exit && local < beats(h).departDoorClose) return { train: h.depart, action: "exit", strength: departDoorState(h, local).highlight };
  return { train: h.arrive, action: "board", strength: arriveDoorState(h, local).highlight };
}

/** Every moment the viewer's view should briefly go dark — stepping out of a ride cabin (a handoff
 * starting) or stepping through a new train's door (a handoff ending) — re-exported so
 * `EvolutionEraFade` (an HTML overlay outside the canvas) can pulse black at exactly these points. */
export const EVOLUTION_TRANSITION_POINTS = [H1.end, H2.start, H2.end, H3.start, H3.end];

const SKY_START = new THREE.Color("#9a8b74");
const SKY_END = new THREE.Color("#bcd9f0");
const SUN_START = new THREE.Color("#ffcf8a");
const SUN_END = new THREE.Color("#fff6e8");
/** Overhead: a smoke-flattened industrial ceiling that opens into clean blue as the eras pass. */
const ZENITH_START = new THREE.Color("#57534c");
const ZENITH_END = new THREE.Color("#4d8ccc");
/** Matches this scene's own key light, which sits lower than the global one. */
const EVOLUTION_SUN = new THREE.Vector3(10, 14, 6).normalize();

/** Sky/fog/lighting continuously evolve from a hazy industrial dusk (steam) to a clean modern day —
 * visible through the cabin windows and during the platform handoffs alike. */
function EvolutionAtmosphere() {
  const { scene } = useThree();
  const quality = useQuality();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const fogRef = useRef(new THREE.Fog(SKY_START.getHex(), 10, 45));
  const skyColor = useRef(new THREE.Color());

  useEffect(() => {
    scene.fog = fogRef.current;
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    const p = getGlobalProgress(local);
    skyColor.current.lerpColors(SKY_START, SKY_END, p);
    fogRef.current.color.copy(skyColor.current);

    // The sky is published rather than painted: `SkyDome` draws it and bakes the reflection probe
    // from it, so two minutes of industrial haze clearing carries into the cloud cover and into
    // every reflection on the trains, instead of only into the fog.
    skyState.horizon.copy(skyColor.current);
    skyState.zenith.lerpColors(ZENITH_START, ZENITH_END, p);
    skyState.sun.lerpColors(SUN_START, SUN_END, p);
    skyState.sunDirection.copy(EVOLUTION_SUN);
    skyState.cloudCover = THREE.MathUtils.lerp(0.86, 0.3, p);
    skyState.dim = 1;
    fogRef.current.near = THREE.MathUtils.lerp(9, 24, p);
    fogRef.current.far = THREE.MathUtils.lerp(38, 95, p);

    if (dirLightRef.current) {
      dirLightRef.current.color.lerpColors(SUN_START, SUN_END, p);
      dirLightRef.current.intensity = THREE.MathUtils.lerp(2.3, 3.1, p);
    }
    if (ambientRef.current) ambientRef.current.intensity = THREE.MathUtils.lerp(0.42, 0.58, p);
    if (hemiRef.current) {
      // The sky half tracks the sky, which is the way round this was not: it used to tint the
      // *ground* bounce with the sky colour, so the fill came up off the earth in whatever colour
      // the clouds were and down from a permanently white dome.
      hemiRef.current.color.copy(skyColor.current);
      hemiRef.current.intensity = THREE.MathUtils.lerp(0.38, 0.55, p);
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.42} />
      <hemisphereLight ref={hemiRef} color="#9a8b74" groundColor="#4a3f2f" intensity={0.38} />
      {/* This scene is two of the film's five minutes and was running on a hardcoded 1024 shadow
          map — a quarter of the texel density the rest of the film gets on the same machine. It
          now takes the same budget as everything else, and the same `shadow-radius` softening and
          `normalBias` that let the bias be cut from -0.0015 to a figure that does not detach a
          shadow from the thing casting it. */}
      <directionalLight
        ref={dirLightRef}
        position={[10, 14, 6]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]}
        shadow-camera-near={1}
        shadow-camera-far={60}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
        shadow-radius={5}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
    </>
  );
}

/** The station environment, shared by all three handoffs (one instance, not one per handoff) with its
 * own progress animating continuously across the whole scene so the platform/track/signage keep
 * gradually modernizing start to finish. */
function EvolutionStation() {
  const progressRef = useRef(0.08);
  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    progressRef.current = lerp(0.08, 0.55, Math.min(Math.max(local / EVOLUTION_DURATION, 0), 1));
  });
  return (
    <>
      <Railway progressRef={progressRef} />
      <Platform progressRef={progressRef} />
      <Station progressRef={progressRef} />
      <Vegetation />
      <TracksideProps progressRef={progressRef} />
    </>
  );
}

type TrainEffect = React.ComponentType<{ stateRef: React.MutableRefObject<TrainMotionState>; offset?: [number, number, number] }>;

interface TrainHandoffProps {
  handoff: Handoff;
  DepartTrain: React.ComponentType<{ speed: number }>;
  ArriveTrain: React.ComponentType<{ speed: number }>;
  DepartEffect: TrainEffect;
  ArriveEffect: TrainEffect;
}

/**
 * One generation's physical handoff: the viewer steps off the train they just rode (when `exit`), it
 * shuts its door and pulls away, and the next generation's train rolls in and stops with its lit door
 * right beside the viewer for them to board. Both trains stop at `trainRestZ`, so every door lands at
 * the same spot. Both trains sit invisible (opacity 0) outside this handoff's own window, so the three
 * handoffs never show each other's trains.
 */
function TrainHandoff({ handoff, DepartTrain, ArriveTrain, DepartEffect, ArriveEffect }: TrainHandoffProps) {
  const b = beats(handoff);
  const departRestZ = trainRestZ(handoff.depart);
  const arriveRestZ = trainRestZ(handoff.arrive);
  const departState = useRef<TrainMotionState>({ z: departRestZ, opacity: 0 });
  const arriveState = useRef<TrainMotionState>({ z: TRAIN_OFFSCREEN_Z, opacity: 0 });
  const departDoor = useRef<DoorState>({ open: 0, highlight: 0 });
  const arriveDoor = useRef<DoorState>({ open: 0, highlight: 0 });

  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    if (local < handoff.start - 0.5 || local > handoff.end + 0.5) {
      departState.current.opacity = 0;
      arriveState.current.opacity = 0;
      return;
    }
    const departP = smootherstep((local - b.departStart) / (b.departEnd - b.departStart));
    departState.current = {
      z: lerp(departRestZ, TRAIN_OFFSCREEN_Z, departP),
      opacity: local < handoff.start || departP >= 1 ? 0 : 1,
      speed: departP * 4,
    };

    const arriveP = smootherstep((local - b.arriveStart) / (b.arriveEnd - b.arriveStart));
    arriveState.current = {
      z: lerp(TRAIN_OFFSCREEN_Z, arriveRestZ, arriveP),
      opacity: local >= b.arriveStart ? 1 : 0,
      speed: (1 - arriveP) * 4,
    };

    departDoor.current = departDoorState(handoff, local);
    arriveDoor.current = arriveDoorState(handoff, local);
  });

  // The viewer's platform spot is on the -Z side of both doors, so both leaves swing open toward +Z.
  return (
    <>
      <TrainCarrier stateRef={departState}>
        <DepartTrain speed={4} />
        <BoardingDoorway spec={TRAIN_DOORS[handoff.depart]} stateRef={departDoor} swingToward={1} />
      </TrainCarrier>
      <DepartEffect stateRef={departState} />
      <TrainCarrier stateRef={arriveState}>
        <ArriveTrain speed={4} />
        <BoardingDoorway spec={TRAIN_DOORS[handoff.arrive]} stateRef={arriveDoor} swingToward={1} />
      </TrainCarrier>
      <ArriveEffect stateRef={arriveState} />
    </>
  );
}

interface EraCabinProps {
  theme: CabinTheme;
  era: TrainNpcEra;
  start: number;
  end: number;
  /** Stay fully visible past `end` instead of fading out (the modern-era cabin persists into "final"). */
  persist?: boolean;
}

/** Cabin-local Z of the seated viewer (`SEAT_POS`) — that aisle seat stays empty. */
const EVOLUTION_SEAT_Z = [0.4];
const ERA_DENSITY: Record<TrainNpcEra, number> = { steam: 0.55, diesel: 0.55, electric: 0.65, modern: 0.8 };
const CABIN_FADE_IN = 1.1;
const CABIN_FADE_OUT = 0.5;

/** One era's cabin, faded in as the viewer steps aboard and (unless `persist`) out as they step off,
 * each paired with `EvolutionEraFade`'s brief full-black beat. Its end doors open as the train stops. */
function EraCabin({ theme, era, start, end, persist = false }: EraCabinProps) {
  const passengers = useMemo(
    () => ({ era, seed: start * 7 + 3, density: ERA_DENSITY[era], avoidZ: EVOLUTION_SEAT_Z, standing: era !== "diesel" }),
    [era, start],
  );
  const groupRef = useRef<THREE.Group>(null);
  const doorOpenRef = useRef(0);

  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    let opacity: number;
    if (local < start) opacity = 0;
    else if (local < start + CABIN_FADE_IN) opacity = (local - start) / CABIN_FADE_IN;
    else if (!persist && local > end - CABIN_FADE_OUT) opacity = 1 - (local - (end - CABIN_FADE_OUT)) / CABIN_FADE_OUT;
    else opacity = 1;
    applyOpacity(groupRef.current, Math.min(Math.max(opacity, 0), 1));
    doorOpenRef.current = persist ? 0 : cabinExitDoorOpen(end, local);
  });

  return (
    <group ref={groupRef}>
      <Cabin theme={theme} length={9} seatSpan={[-3.5, 3.5]} openFarEnd doorOpenRef={doorOpenRef} passengers={passengers} />
    </group>
  );
}

/**
 * The high-speed unit the viewer boards is the one that started the whole stage: Japan, 1 October
 * 1964, ivory and blue, a blunt nose and 210 km/h on track built for nothing else. Declared here at
 * module level rather than inline so the handoff is not handed a new component type every render.
 */
const ShinkansenTrain = (props: { speed: number }) => <ModernTrain {...props} livery="shinkansen" />;

/** The viewer's platform standing spot during handoffs (`PLATFORM_POS` x/z). */
const HANDOFF_CROWD_AVOID: [number, number][] = [[-2.6, 1.5]];

/**
 * Platform signage for the high-speed handoff, in the language of the railway that opened it, and
 * shown only while the viewer is standing on that platform — the two handoffs before it are not in
 * Japan. Placed down the line in the direction the camera is already looking as the train rolls in.
 */
function ShinkansenSignage({ start, end }: { start: number; end: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    if (groupRef.current) groupRef.current.visible = local >= start && local < end;
  });
  return (
    <group ref={groupRef} visible={false}>
      <DepartureBoard
        position={[-4.2, 0.5, 6]}
        yaw={2.8}
        title="ひかり · HIKARI"
        subtitle="新大阪 SHIN-OSAKA · 210 km/h"
        width={2.1}
        background="#0d1622"
        color="#f2f6fa"
      />
      <DepartureBoard
        position={[-4.4, 0.5, -3.4]}
        yaw={2.2}
        title="東京 TOKYO"
        subtitle="東海道新幹線 · TOKAIDO SHINKANSEN · 1964"
        width={1.8}
        background="#12202c"
        color="#e8f0f6"
      />
    </group>
  );
}

/** Platform NPCs for one handoff, dressed for the arriving train's era and shown only while the
 * viewer is standing on the platform for that handoff. */
function HandoffCrowd({ start, end, era, seed }: { start: number; end: number; era: NpcEra; seed: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    if (groupRef.current) groupRef.current.visible = local >= start && local < end;
  });
  return (
    <group ref={groupRef} visible={false}>
      <PlatformCrowd era={era} seed={seed} avoid={HANDOFF_CROWD_AVOID} />
    </group>
  );
}

/** Scrolling window scenery whose speed follows the ride (pulling away, cruising, braking) — hidden
 * during the platform handoffs so it doesn't visually overlap the station environment. */
function EvolutionWindowView() {
  const distanceRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    const era = getEraAtTime(local);
    distanceRef.current += era.trainSpeed * delta * 2.2 * rideSpeedFactor(local);
    if (groupRef.current) groupRef.current.visible = !inAnyHandoff(local);
  });

  return (
    <group ref={groupRef}>
      <GroundStrip color="#7c8a72" />
      <TreeField distanceRef={distanceRef} density={0.9} />
      <MountainBackdrop distanceRef={distanceRef} />
    </group>
  );
}

/** Drives speed-line intensity from the active era's speed and the ride's current speed factor. */
function EvolutionSpeedLines() {
  const speedRef = useRef(0);
  useFrame(() => {
    const local = getSceneLocal(timelineStore.getElapsed()).local;
    speedRef.current = getEraAtTime(local).trainSpeed * 3 * rideSpeedFactor(local);
  });
  return <SpeedLinesEffect speedRef={speedRef} />;
}

/**
 * The Evolution scene, first-person throughout: ride each generation's cabin (steam -> diesel ->
 * electric -> modern), and at every stop step off through the train's highlighted door, watch it
 * leave, and board the next generation through its highlighted door.
 */
export function EvolutionScene() {
  return (
    <>
      <EvolutionAtmosphere />
      <EvolutionStation />
      <TrainHandoff handoff={H1} DepartTrain={SteamTrain} ArriveTrain={DieselTrain} DepartEffect={SteamEffect} ArriveEffect={DieselExhaustEffect} />
      <TrainHandoff handoff={H2} DepartTrain={DieselTrain} ArriveTrain={ElectricTrain} DepartEffect={DieselExhaustEffect} ArriveEffect={ElectricSparkEffect} />
      <TrainHandoff handoff={H3} DepartTrain={ElectricTrain} ArriveTrain={ShinkansenTrain} DepartEffect={ElectricSparkEffect} ArriveEffect={ElectricSparkEffect} />
      <HandoffCrowd start={H1.start} end={H1.end} era="diesel" seed={71} />
      <HandoffCrowd start={H2.start} end={H2.end} era="electric" seed={72} />
      <HandoffCrowd start={H3.start} end={H3.end} era="modern" seed={73} />
      <ShinkansenSignage start={H3.start} end={H3.end} />
      <EvolutionWindowView />
      <EraCabin theme={DIESEL_THEME} era="diesel" start={H1.end} end={H2.start} />
      <EraCabin theme={CLASSIC_THEME} era="electric" start={H2.end} end={H3.start} />
      <EraCabin theme={MODERN_THEME} era="modern" start={H3.end} end={FINAL_ERA.end} persist />
      <EvolutionSpeedLines />
    </>
  );
}

// The viewer's spot on the platform during a handoff: matches `ExteriorRideScene`'s final resting shot.
const PLATFORM_POS: [number, number, number] = [-2.6, 1.65, 1.5];

// Seated inside whichever cabin is currently active: mouse-look supplies all the "looking around".
const SEAT_POS: [number, number, number] = [0.5, 1.2, 0.4];
const SEAT_LOOK: [number, number, number] = [0, 1.35, -3.5];

function doorLook(train: DoorTrain): [number, number, number] {
  return [TRAIN_DOORS[train].x - 0.05, 1.38, DOOR_STOP_Z];
}

/** Step off (if `exit`), watch the old train leave and the new one arrive, then walk aboard. */
function handoffShots(h: Handoff): Shot[] {
  const o = h.exit ? 0 : NO_EXIT_OFFSET;
  const s = h.start;
  const departDoorX = TRAIN_DOORS[h.depart].x;
  const arriveDoorX = TRAIN_DOORS[h.arrive].x;
  const insideLook: [number, number, number] = [0, 1.55, DOOR_STOP_Z];

  const exitShots: Shot[] = h.exit
    ? [
        { t: s, pos: [departDoorX + 0.15, 1.72, DOOR_STOP_Z], look: [-3, 1.5, DOOR_STOP_Z - 0.5] }, // in the open doorway
        { t: s + 2, pos: [-1.4, 1.68, DOOR_STOP_Z - 0.2], look: [-3.2, 1.5, 2.2] }, // step down
        { t: s + 4, pos: [-2.3, 1.66, 1.9], look: [-3.4, 1.5, 1] }, // onto the platform
        { t: s + 5.5, pos: PLATFORM_POS, look: doorLook(h.depart) }, // turn back as its door shuts
      ]
    : [{ t: s, pos: PLATFORM_POS, look: doorLook(h.depart) }];

  return [
    ...exitShots,
    { t: s + 7 + o, pos: PLATFORM_POS, look: [0, 1.4, 7] }, // watch it pull away
    { t: s + 12 + o, pos: PLATFORM_POS, look: [-0.4, 1.4, 6] }, // the next train rolls in
    { t: s + 18 + o, pos: PLATFORM_POS, look: doorLook(h.arrive) }, // it stops with its door lit up beside us
    { t: s + 20.5 + o, pos: PLATFORM_POS, look: doorLook(h.arrive) }, // door swings open
    { t: s + 23 + o, pos: [-1.75, 1.66, DOOR_STOP_Z - 0.35], look: doorLook(h.arrive) }, // walk to it
    { t: s + 24.3 + o, pos: [arriveDoorX - 0.23, 1.72, DOOR_STOP_Z], look: insideLook }, // step up
    { t: h.end, pos: [arriveDoorX - 0.12, 1.74, DOOR_STOP_Z], look: insideLook }, // through the door
  ];
}

/** The train has stopped: get up from the seat and walk down the aisle to the opening cabin doors. */
function rideExitShots(h: Handoff): Shot[] {
  return [
    { t: h.start - RIDE_EXIT_WALK_SECONDS, pos: SEAT_POS, look: SEAT_LOOK },
    { t: h.start - 1.8, pos: [0.15, 1.55, 0.1], look: [0, 1.5, -4.5] },
    { t: h.start, pos: [0, 1.55, -3.1], look: [0, 1.5, -6] },
  ];
}

const HANDOFF_SHOTS = new Map(HANDOFFS.map((h) => [h, handoffShots(h)]));
const RIDE_EXIT_SHOTS = new Map(HANDOFFS.filter((h) => h.exit).map((h) => [h, rideExitShots(h)]));

/** Door choreography during each handoff, the walk to the cabin door as a ride ends, and seated for
 * the rest of each ride — mouse-look (in `CameraDirector`) does the "looking around" throughout. */
export function evolutionShot(local: number): CameraShotResult {
  const h = handoffAt(local);
  if (h) return sampleShots(local, HANDOFF_SHOTS.get(h)!);
  const exit = upcomingExit(local, RIDE_EXIT_WALK_SECONDS);
  if (exit) return sampleShots(local, RIDE_EXIT_SHOTS.get(exit)!);
  const settle = Math.min((local - currentRideStart(local)) / 1.5, 1);
  return { pos: [SEAT_POS[0], SEAT_POS[1], SEAT_POS[2] * settle], look: SEAT_LOOK };
}

/** The audible moments inside one handoff, lifted straight off the same `beats()` the visuals use so
 * horns and announcements can't drift out of sync with the trains they belong to. */
export interface EvolutionAudioBeat {
  /** The generation pulling out, and the one rolling in behind it. */
  depart: DoorTrain;
  arrive: DoorTrain;
  start: number;
  departStart: number;
  arriveEnd: number;
}

export const EVOLUTION_AUDIO_BEATS: EvolutionAudioBeat[] = HANDOFFS.map((h) => {
  const b = beats(h);
  return { depart: h.depart, arrive: h.arrive, start: h.start, departStart: b.departStart, arriveEnd: b.arriveEnd };
});

/** True while the viewer is standing on the platform between two generations rather than riding. */
export function evolutionOnPlatform(local: number): boolean {
  return inAnyHandoff(local);
}

/** True while the viewer is on their feet — crossing the platform, or walking the aisle to the doors. */
export function evolutionOnFoot(local: number): boolean {
  return inAnyHandoff(local) || upcomingExit(local, RIDE_EXIT_WALK_SECONDS) !== undefined;
}
