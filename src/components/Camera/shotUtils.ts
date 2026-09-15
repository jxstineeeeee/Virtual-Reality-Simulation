import * as THREE from "three";
import { clamp01, smootherstep } from "../../timeline/timeline";

export interface Shot {
  /** local scene time (seconds) this keyframe is reached at */
  t: number;
  pos: [number, number, number];
  look: [number, number, number];
}

export interface CameraShotResult {
  pos: [number, number, number];
  look: [number, number, number];
}

const va = new THREE.Vector3();
const vb = new THREE.Vector3();

/** Interpolates through an ordered list of camera keyframes by local scene time, easing each segment. */
export function sampleShots(t: number, shots: Shot[]): CameraShotResult {
  if (shots.length === 0) return { pos: [0, 2, 10], look: [0, 1, 0] };
  if (t <= shots[0].t) return { pos: shots[0].pos, look: shots[0].look };

  for (let i = 0; i < shots.length - 1; i++) {
    const a = shots[i];
    const b = shots[i + 1];
    if (t >= a.t && t <= b.t) {
      const p = smootherstep(clamp01((t - a.t) / Math.max(b.t - a.t, 0.0001)));
      va.set(a.pos[0], a.pos[1], a.pos[2]).lerp(vb.set(b.pos[0], b.pos[1], b.pos[2]), p);
      const pos: [number, number, number] = [va.x, va.y, va.z];
      va.set(a.look[0], a.look[1], a.look[2]).lerp(vb.set(b.look[0], b.look[1], b.look[2]), p);
      const look: [number, number, number] = [va.x, va.y, va.z];
      return { pos, look };
    }
  }
  const last = shots[shots.length - 1];
  return { pos: last.pos, look: last.look };
}
