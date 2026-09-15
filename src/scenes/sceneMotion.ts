import { lerp } from "../timeline/timeline";

/** Distance traveled under a linear speed ramp from 0 to `cruiseSpeed` over `rampSeconds`, then constant. */
export function rampDistance(local: number, rampSeconds: number, cruiseSpeed: number): number {
  if (rampSeconds <= 0) return cruiseSpeed * local;
  if (local <= rampSeconds) return 0.5 * (cruiseSpeed / rampSeconds) * local * local;
  const rampDist = 0.5 * cruiseSpeed * rampSeconds;
  return rampDist + cruiseSpeed * (local - rampSeconds);
}

/** Instantaneous speed for the same linear ramp used by `rampDistance`. */
export function rampSpeed(local: number, rampSeconds: number, cruiseSpeed: number): number {
  if (local >= rampSeconds) return cruiseSpeed;
  return (local / rampSeconds) * cruiseSpeed;
}

/** Instantaneous speed under a linear deceleration from `startSpeed` to 0 over `decelSeconds`. */
export function decelSpeed(local: number, decelSeconds: number, startSpeed: number): number {
  if (local >= decelSeconds) return 0;
  return lerp(startSpeed, 0, local / decelSeconds);
}

/** Distance traveled under the same linear deceleration used by `decelSpeed`. */
export function decelDistance(local: number, decelSeconds: number, startSpeed: number): number {
  const t = Math.min(Math.max(local, 0), decelSeconds);
  const speedAtT = lerp(startSpeed, 0, t / decelSeconds);
  return 0.5 * (startSpeed + speedAtT) * t;
}
