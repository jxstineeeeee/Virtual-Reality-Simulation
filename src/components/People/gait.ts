import { clamp01, smootherstep } from "../../timeline/timeline";

/**
 * The pace model every walker in the film shares.
 *
 * Ground speed is step length times cadence, so a figure cannot be slowed down by shrinking its leg
 * swing alone: shorten the steps while the ground still slides past at speed and the feet skate.
 * Here a single factor — `gait`, 0 standing .. 1 full pace — scales step length *and* cadence
 * together, which makes ground speed proportional to `gait²` and keeps the planted foot still at
 * every pace, all the way through a start and a stop. Slowing to a halt is then what it is in life:
 * shorter, slower steps, not a stride shrinking on the spot and a body sliding to a stand.
 *
 * Everything below is closed form in the timeline clock rather than integrated frame to frame, so a
 * walker starts, stops and turns identically at any frame rate, and scrubs and pauses with the film.
 */

/** Metres of ground covered per full gait cycle (two steps) at full pace — `Person`'s leg geometry. */
export const STRIDE_LENGTH = 1.4;

/** Seconds a walker spends coming up to pace, and the same again settling out of it. */
export const GAIT_RAMP = 0.85;

/**
 * Seconds of full-pace travel one second of ramp covers: ∫₀¹ gait² du, which comes out exactly
 * 181/462. A start and a stop therefore give up `2·(1 − that)` seconds of cruising between them.
 */
const RAMP_TRAVEL = 181 / 462;
const RAMP_COST = 2 * (1 - RAMP_TRAVEL);

/** Gait factor `s` seconds into a ramp of `r`: smootherstep, so pace leaves zero with no kick. */
function rampGait(s: number, r: number): number {
  return smootherstep(s / r);
}

/**
 * ∫gait over a ramp, in seconds of full-pace walking — what the gait *cycle* is clocked off, cadence
 * being proportional to gait. Exact: ∫(6u⁵−15u⁴+10u³) du = u⁴(u²−3u+2.5), which is ½ at u = 1.
 */
function rampStrideTime(s: number, r: number): number {
  if (s <= 0) return 0;
  if (s >= r) return s - r * 0.5;
  const u = s / r;
  return r * u * u * u * u * (u * (u - 3) + 2.5);
}

/**
 * ∫gait² over a ramp, in seconds of full-pace travel — the ground a ramp actually covers, speed being
 * proportional to gait². gait² = 100u⁶ − 300u⁷ + 345u⁸ − 180u⁹ + 36u¹⁰, integrated term by term.
 */
function rampTravel(s: number, r: number): number {
  if (s <= 0) return 0;
  if (s >= r) return s - r * (1 - RAMP_TRAVEL);
  const u = s / r;
  const poly = 100 / 7 + u * (-37.5 + u * (115 / 3 + u * (-18 + u * (36 / 11))));
  return r * u ** 7 * poly;
}

export interface GaitSample {
  /** Metres of ground covered so far. */
  distance: number;
  /** 0 standing .. 1 full pace. Scales step length and cadence together; drives `NpcMotion.walk`. */
  gait: number;
  /** Radians of gait cycle covered so far — `NpcMotion.stride`, before any lap offset. */
  stride: number;
}

/** Seconds a walk of `metres` at `speed` takes from a standing start to a standing stop. */
export function walkSpan(metres: number, speed: number, ramp = GAIT_RAMP): number {
  return metres / speed + ramp * RAMP_COST;
}

/**
 * A walk that starts from rest and comes back to rest: `s` seconds into a leg lasting `span` seconds
 * and covering exactly `metres` end to end, whatever `span` is. Use `walkSpan` to pick the span that
 * cruises at the pace you want; a longer one simply walks the same ground more gently.
 */
export function walkLeg(s: number, span: number, metres: number, ramp = GAIT_RAMP, strideLength = STRIDE_LENGTH): GaitSample {
  // Ramps that would overlap are shortened to meet in the middle: a couple of paces across a
  // platform then never quite reaches full pace, which is what a couple of paces look like anyway.
  const r = Math.min(ramp, span / 2);
  const cruise = metres / Math.max(span - r * RAMP_COST, 1e-4);
  const u = Math.min(Math.max(s, 0), span);
  const gait = Math.min(rampGait(u, r), rampGait(span - u, r));

  // Past the last ramp everything is measured backwards from the far end instead of forwards, so the
  // stop is the exact mirror of the start and the walk lands on `metres` rather than near it.
  const decelerating = u > span - r;
  const back = span - u;
  const travel = decelerating ? span - r * RAMP_COST - rampTravel(back, r) : rampTravel(u, r);
  const strideTime = decelerating ? span - r - rampStrideTime(back, r) : rampStrideTime(u, r);

  return { distance: cruise * travel, gait, stride: ((cruise * strideTime) / strideLength) * Math.PI * 2 };
}

/** Peak gait of a turn on the spot: real steps, but shorter ones than walking takes. */
const PIVOT_GAIT = 0.7;

/**
 * A turn on the spot. The body covers no ground, but the feet still step round it, so gait and stride
 * both keep moving through the turn — legs that freeze for its whole length read as a mannequin being
 * spun. `sin²` so the shuffle starts and ends with no kick, and `turn` is its exact integral: the
 * body comes round at precisely the rate the feet are stepping, and is square again at either end.
 */
export function pivotGait(s: number, seconds: number, speed: number, strideLength = STRIDE_LENGTH): { gait: number; stride: number; turn: number } {
  const f = clamp01(s / seconds);
  const gait = PIVOT_GAIT * Math.sin(Math.PI * f) ** 2;
  const turn = f - Math.sin(2 * Math.PI * f) / (2 * Math.PI);
  const strideTime = PIVOT_GAIT * seconds * turn * 0.5;
  return { gait, stride: ((speed * strideTime) / strideLength) * Math.PI * 2, turn };
}

/**
 * Gait-cycle radians a figure of stride `strideLength` has covered after `strideTime` seconds of
 * walking whose full pace is `speed`. Lets one mover drive figures of different stride off the same
 * number — a man and the horse he is walking beside stay in step through a start this way.
 */
export function strideRadians(strideTime: number, speed: number, strideLength = STRIDE_LENGTH): number {
  return ((strideTime * speed) / strideLength) * Math.PI * 2;
}
