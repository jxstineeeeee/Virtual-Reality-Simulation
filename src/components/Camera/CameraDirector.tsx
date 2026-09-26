import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { getSceneLocal, type SceneId } from "../../timeline/timeline";
import { lookInput } from "./lookInput";
import { cameraFocusState } from "../../state/cameraFocusState";
import { settingsStore } from "../../state/settingsStore";

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Scenes where the camera is a person's head — seated in a carriage, or on their feet beside the
 * track — get a faint procedural sway, because nobody holds perfectly still. Purely cinematic
 * scenes stay untouched so hard-cut shots never pick up a wobble. */
const HANDHELD_SWAY_SCENES = new Set<SceneId>(["earlyRail", "interior", "departure", "journey", "exteriorRide", "arrival", "evolution"]);
const SWAY_AMPLITUDE = 0.012; // meters — deliberately tiny; this is a sway, not a shake

/** Absolute pitch clamp on the *final* look direction (scripted gaze + mouse offset combined), so
 * looking up/down from an already-steep scripted shot still can't flip past straight up or down. */
const PITCH_LIMIT_ABS = (80 * Math.PI) / 180;

// ---------------------------------------------------------------------------------------------
// Calm mode.
//
// The scenes describe a camera that walks *and* looks: the keyframes swing the gaze out of the
// window, up at the ceiling, round to the door. Watched on a desktop that is direction; worn on a
// phone in a headset it is someone else turning your head, and it is the single most disorienting
// thing the film does. Calm mode keeps the blocking — you still walk the platform, board, sit down,
// ride — and takes away everything that moves your head that you did not move yourself.
//
// Two rules do all of it:
//
//  * The gaze faces the way you are travelling. Nothing else turns it, so a walk that curves toward
//    a door turns your head the way walking does, and a stationary shot holds dead still.
//  * Position follows the blocking, but softly. Scenes shift the camera around inside a carriage by
//    half a metre at a time to find a nicer angle on a seat; at rest those read as fidgeting. So the
//    camera chases only the part of the offset that is past `CALM_DEADBAND` at walking pace, and
//    quietly closes the rest at `CALM_SETTLE_RATE`. A real walk is nearly all past the deadband and
//    so is followed stride for stride; a half-metre reposition is nearly all inside it and becomes a
//    drift too slow to feel.
//
//    This used to be a hysteresis gate — stand still until the blocking is 1.2m away, then chase it
//    down to within 0.25m, then stand still again. On a platform walk, where the blocking only pulls
//    away at a quarter of a metre a second, that plays as seconds of standing rooted followed by a
//    lunge, over and over. A deadband the camera leaks through has no such edge to trip over: the
//    follow speed is a continuous function of the offset, so it can neither hunt nor lurch.
// ---------------------------------------------------------------------------------------------

/**
 * Metres of slack in calm mode's follow. Inside this the camera only creeps, so a hold stays a hold.
 *
 * It is also the lag at the back of a walk: the camera trails the blocking by roughly this far while
 * travelling, and reels it in once the blocking stops.
 */
const CALM_DEADBAND = 0.35;
/**
 * Fraction of the slack closed per second once the camera is inside the deadband.
 *
 * Deliberately slow enough that closing a full deadband's worth stays under `CALM_TURN_SPEED`: a
 * settle should never register as travel and turn the viewer's head for them.
 */
const CALM_SETTLE_RATE = 0.25;
/** Below this ground speed (m/s) there is no travel direction to face, so the heading holds. */
const CALM_TURN_SPEED = 0.12;
/**
 * How far off the current heading a move has to be before it stops counting as walking.
 *
 * Nobody walks backwards. When the blocking slides the camera back down the aisle to find a
 * different angle on a seat, that is a dolly, not the viewer turning round — and following it
 * literally swings the head 180 degrees into the seat back twenty centimetres behind. A step to the
 * side, like turning off a platform into a doorway, is real walking and is well inside this cone.
 */
const CALM_MAX_TURN = (110 * Math.PI) / 180;

/** Signed shortest way round from `from` to `to`, so a heading crossing +/-pi does not unwind. */
function shortestAngle(from: number, to: number): number {
  return ((((to - from + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
}

/** Lerp toward an angle the short way round. */
function dampAngle(current: number, target: number, t: number): number {
  return current + shortestAngle(current, target) * t;
}

function distance3(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

import type { CameraShotResult } from "./shotUtils";
import { earlyRailShot } from "../../scenes/EarlyRailScene";
import { boardingShot } from "../../scenes/BoardingScene";
import { interiorShot } from "../../scenes/InteriorScene";
import { departureShot } from "../../scenes/DepartureScene";
import { journeyShot } from "../../scenes/JourneyScene";
import { exteriorRideShot } from "../../scenes/ExteriorRideScene";
import { evolutionShot } from "../../scenes/EvolutionScene";
import { modernRideShot } from "../../scenes/ModernRideScene";
import { arrivalShot } from "../../scenes/ArrivalScene";

type ShotFn = (local: number, elapsed: number) => CameraShotResult;

const SHOTS: Record<SceneId, ShotFn> = {
  earlyRail: earlyRailShot,
  boarding: boardingShot,
  interior: interiorShot,
  departure: departureShot,
  journey: journeyShot,
  exteriorRide: exteriorRideShot,
  evolution: evolutionShot,
  modernRide: modernRideShot,
  arrival: arrivalShot,
};

/**
 * The single camera driver for the whole five-minute experience: every frame it looks up which scene
 * is active, asks that scene's pure shot function for the desired pose, and eases the real R3F
 * camera toward it. Scenes marked `hardCut` snap instantly on entry instead of drifting into frame.
 */
export function CameraDirector() {
  const { camera } = useThree();
  const currentPos = useRef<[number, number, number]>([0, 2, 10]);
  const currentLook = useRef<[number, number, number]>([0, 1.5, 0]);
  const lastScene = useRef<SceneId | null>(null);
  const currentYaw = useRef(0);
  const currentPitch = useRef(0);
  const dir = useRef(new THREE.Vector3());
  const deviceQuat = useRef(new THREE.Quaternion());
  /** Calm mode: the heading the viewer is walking in, and where they were last frame to measure it. */
  const travelYaw = useRef(0);
  const previousPos = useRef<[number, number, number]>([0, 2, 10]);
  const wasCalm = useRef(false);

  useFrame((_, delta) => {
    const elapsed = timelineStore.getElapsed();
    const { scene, local } = getSceneLocal(elapsed);
    const { pos, look } = SHOTS[scene.id](local, elapsed);

    const calm = settingsStore.getCamera() === "calm";
    const modeChanged = calm !== wasCalm.current;
    wasCalm.current = calm;

    const justCut = scene.hardCut && lastScene.current !== scene.id;
    const sceneChanged = lastScene.current !== scene.id;
    lastScene.current = scene.id;

    if (justCut) {
      currentPos.current = pos;
      currentLook.current = look;
    } else {
      const damp = 1 - Math.pow(0.0005, delta);
      currentLook.current = lerp3(currentLook.current, look, damp);
      if (calm) {
        // Travel: chase the offset beyond the deadband at the same pace a cinematic camera follows,
        // which for a walk is everything but the last `CALM_DEADBAND` of it.
        const gap = distance3(currentPos.current, pos);
        const chase = Math.max(0, gap - CALM_DEADBAND) / Math.max(gap, 1e-6);
        if (chase > 0) currentPos.current = lerp3(currentPos.current, pos, damp * chase);
        // Settle: and creep after the rest, so the blocking's intent — through that door, down onto
        // that seat — is honoured in the end rather than left a deadband short of it forever.
        currentPos.current = lerp3(currentPos.current, pos, 1 - Math.pow(1 - CALM_SETTLE_RATE, delta));
      } else {
        currentPos.current = lerp3(currentPos.current, pos, damp);
      }
    }

    let [px, py, pz] = currentPos.current;
    // The sway is a held camera breathing. In calm mode the viewer is the camera, and a head that
    // drifts on its own is exactly what this mode exists to remove.
    if (!calm && HANDHELD_SWAY_SCENES.has(scene.id)) {
      // Two off-ratio sine waves so the sway doesn't read as a mechanical, perfectly periodic loop.
      const time = timelineStore.getElapsed();
      px += Math.sin(time * 0.55) * SWAY_AMPLITUDE + Math.sin(time * 1.3) * SWAY_AMPLITUDE * 0.4;
      py += Math.sin(time * 0.7 + 1.1) * SWAY_AMPLITUDE * 0.6;
    }
    camera.position.set(px, py, pz);

    // First-person look: decompose the scene's scripted gaze direction into yaw/pitch, then layer the
    // viewer's own head turning (mouse, finger drag, or phone gyro — see `lookInput`) on top. The
    // cinematic blocking still decides "forward", so every scene's camera pos/timing is untouched.
    const [lx, ly, lz] = currentLook.current;
    dir.current.set(lx - px, ly - py, lz - pz);
    const lookDist = Math.max(dir.current.length(), 0.001);
    // What this shot is looking at is what the lens should be focused on — see `cameraFocusState`.
    // Eased rather than snapped, so a cut or a fast pan racks focus instead of popping.
    cameraFocusState.distance += (lookDist - cameraFocusState.distance) * Math.min(1, delta * 3);
    dir.current.normalize();
    const scriptedYaw = Math.atan2(dir.current.x, dir.current.z);
    const scriptedPitch = Math.asin(THREE.MathUtils.clamp(dir.current.y, -1, 1));

    let baseYaw = scriptedYaw;
    let basePitch = scriptedPitch;
    if (calm) {
      const groundSpeed = Math.hypot(px - previousPos.current[0], pz - previousPos.current[2]) / Math.max(delta, 1e-4);
      if (justCut || modeChanged || sceneChanged) {
        // Entering a scene, or the mode, the viewer has to be facing *something* sensible; the
        // scripted gaze is the scene author's answer to that and it is only used at this one moment.
        travelYaw.current = scriptedYaw;
      } else if (groundSpeed > CALM_TURN_SPEED) {
        const heading = Math.atan2(px - previousPos.current[0], pz - previousPos.current[2]);
        if (Math.abs(shortestAngle(travelYaw.current, heading)) < CALM_MAX_TURN) {
          travelYaw.current = dampAngle(travelYaw.current, heading, 1 - Math.pow(0.02, delta));
        }
      }
      baseYaw = travelYaw.current;
      // Level. Anything else is the film tilting your head for you.
      basePitch = 0;
    }
    previousPos.current = [px, py, pz];

    const lookDamp = 1 - Math.pow(0.00005, delta);
    currentYaw.current = THREE.MathUtils.lerp(currentYaw.current, lookInput.mouseYaw, lookDamp);
    currentPitch.current = THREE.MathUtils.lerp(currentPitch.current, lookInput.mousePitch, lookDamp);

    // Finger drag adds unlimited yaw on top, so a phone can spin all the way around (360°).
    const yaw = baseYaw + currentYaw.current + lookInput.dragYaw;

    if (lookInput.readDeviceQuaternion(deviceQuat.current)) {
      // Phone gyro (full 360°): the scripted gaze decides which way is "forward", and the phone's own
      // orientation — pitch and roll included — is applied on top, unsmoothed so head motion never lags.
      // A camera with rotation.y = θ looks along (-sin θ, 0, -cos θ), hence the +π.
      camera.quaternion.setFromAxisAngle(Y_AXIS, yaw + Math.PI).multiply(deviceQuat.current);
      return;
    }

    const pitch = THREE.MathUtils.clamp(basePitch + currentPitch.current + lookInput.dragPitch, -PITCH_LIMIT_ABS, PITCH_LIMIT_ABS);
    dir.current.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

    camera.lookAt(px + dir.current.x * lookDist, py + dir.current.y * lookDist, pz + dir.current.z * lookDist);
  });

  return null;
}

function lerp3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
