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

/** Guard for keyframes written at the same time, so a segment can never divide by zero. */
const MIN_SEGMENT = 1e-4;

type Channel = "pos" | "look";

/** Average speed of one component across the segment starting at keyframe `i`. */
function slope(shots: Shot[], i: number, channel: Channel, c: number): number {
  const h = Math.max(shots[i + 1].t - shots[i].t, MIN_SEGMENT);
  return (shots[i + 1][channel][c] - shots[i][channel][c]) / h;
}

/**
 * Speed of one component *at* keyframe `i`, shared by the segments either side of it.
 *
 * The ends of a shot list are held at zero, so a scene still eases out of rest and settles into its
 * final pose. Everywhere else this is the PCHIP tangent: zero wherever the two segments disagree
 * about direction (a reversal, or a keyframe that merely repeats the last one — a hold), and
 * otherwise a weighted harmonic mean of the slopes either side, which is the term that keeps the
 * curve monotone. Monotone matters as much as smooth here: it is what stops the camera sailing past
 * a doorway or a seat and sliding back into it.
 */
function tangent(shots: Shot[], i: number, channel: Channel, c: number): number {
  if (i <= 0 || i >= shots.length - 1) return 0;
  const before = slope(shots, i - 1, channel, c);
  const after = slope(shots, i, channel, c);
  if (before * after <= 0) return 0;
  const hBefore = Math.max(shots[i].t - shots[i - 1].t, MIN_SEGMENT);
  const hAfter = Math.max(shots[i + 1].t - shots[i].t, MIN_SEGMENT);
  const wBefore = 2 * hAfter + hBefore;
  const wAfter = hAfter + 2 * hBefore;
  return (wBefore + wAfter) / (wBefore / before + wAfter / after);
}

/** Cubic Hermite value for one component, `u` in 0..1 across a segment of length `h` seconds. */
function hermite(shots: Shot[], i: number, channel: Channel, c: number, u: number, h: number): number {
  const p0 = shots[i][channel][c];
  const p1 = shots[i + 1][channel][c];
  const m0 = tangent(shots, i, channel, c);
  const m1 = tangent(shots, i + 1, channel, c);
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * m1;
}

function triple(shots: Shot[], i: number, channel: Channel, u: number, h: number): [number, number, number] {
  return [hermite(shots, i, channel, 0, u, h), hermite(shots, i, channel, 1, u, h), hermite(shots, i, channel, 2, u, h)];
}

/**
 * Interpolates through an ordered list of camera keyframes by local scene time.
 *
 * Each segment used to be eased on its own with `smootherstep`, which meant the camera arrived at
 * *every* keyframe at a dead stop and set off again from nothing. A walk written as five waypoints
 * down a platform therefore played as five separate lunges with a pause between each — the keyframes
 * are waypoints along one continuous walk, not a series of destinations.
 *
 * So the curve is shared across keyframes instead: one monotone cubic through the whole list, with a
 * single tangent at each keyframe that both neighbouring segments use (see `tangent`). Speed now
 * carries through a waypoint, and a walk reads as a walk.
 */
export function sampleShots(t: number, shots: Shot[]): CameraShotResult {
  if (shots.length === 0) return { pos: [0, 2, 10], look: [0, 1, 0] };
  if (t <= shots[0].t) return { pos: shots[0].pos, look: shots[0].look };

  for (let i = 0; i < shots.length - 1; i++) {
    if (t >= shots[i].t && t <= shots[i + 1].t) {
      const h = Math.max(shots[i + 1].t - shots[i].t, MIN_SEGMENT);
      const u = Math.min(Math.max((t - shots[i].t) / h, 0), 1);
      return { pos: triple(shots, i, "pos", u, h), look: triple(shots, i, "look", u, h) };
    }
  }
  const last = shots[shots.length - 1];
  return { pos: last.pos, look: last.look };
}
