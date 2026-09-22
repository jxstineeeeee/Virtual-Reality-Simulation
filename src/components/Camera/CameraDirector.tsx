import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { getSceneLocal, type SceneId } from "../../timeline/timeline";
import { lookInput } from "./lookInput";
import { cameraFocusState } from "../../state/cameraFocusState";

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Scenes where the camera is a person's head — seated in a carriage, or on their feet beside the
 * track — get a faint procedural sway, because nobody holds perfectly still. Purely cinematic
 * scenes stay untouched so hard-cut shots never pick up a wobble. */
const HANDHELD_SWAY_SCENES = new Set<SceneId>(["earlyRail", "interior", "departure", "journey", "exteriorRide", "arrival", "evolution"]);
const SWAY_AMPLITUDE = 0.012; // meters — deliberately tiny; this is a sway, not a shake

/** Absolute pitch clamp on the *final* look direction (scripted gaze + mouse offset combined), so
 * looking up/down from an already-steep scripted shot still can't flip past straight up or down. */
const PITCH_LIMIT_ABS = (80 * Math.PI) / 180;

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

  useFrame((_, delta) => {
    const elapsed = timelineStore.getElapsed();
    const { scene, local } = getSceneLocal(elapsed);
    const { pos, look } = SHOTS[scene.id](local, elapsed);

    const justCut = scene.hardCut && lastScene.current !== scene.id;
    lastScene.current = scene.id;

    if (justCut) {
      currentPos.current = pos;
      currentLook.current = look;
    } else {
      const damp = 1 - Math.pow(0.0005, delta);
      currentPos.current = lerp3(currentPos.current, pos, damp);
      currentLook.current = lerp3(currentLook.current, look, damp);
    }

    let [px, py, pz] = currentPos.current;
    if (HANDHELD_SWAY_SCENES.has(scene.id)) {
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
    const baseYaw = Math.atan2(dir.current.x, dir.current.z);
    const basePitch = Math.asin(THREE.MathUtils.clamp(dir.current.y, -1, 1));

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
