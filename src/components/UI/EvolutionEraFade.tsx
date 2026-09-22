import { useSyncExternalStore } from "react";
import { timelineStore } from "../../state/timelineStore";
import { sceneLocalAt } from "../../timeline/timeline";
import { EVOLUTION_TRANSITION_POINTS } from "../../scenes/EvolutionScene";
import { EVOLUTION_DURATION } from "../../data/timeline";

const BOUNDARIES = EVOLUTION_TRANSITION_POINTS;

const FADE = 0.5; // seconds to fade to/from black on each side of a boundary
const HOLD = 0.25; // seconds fully black at the boundary itself

/** 0..1 darkness for a given local Evolution-scene time — a brief "lights dim, brief darkness, lights
 * back up in the next era's cabin" beat at each train-generation boundary, replacing what used to be
 * a camera cut to a new exterior model. */
function darknessAt(local: number): number {
  let max = 0;
  for (const b of BOUNDARIES) {
    const d = local - b;
    let o = 0;
    if (d < -FADE - HOLD || d > FADE + HOLD) o = 0;
    else if (d < -HOLD) o = 1 - Math.abs(d + HOLD) / FADE;
    else if (d > HOLD) o = 1 - (d - HOLD) / FADE;
    else o = 1;
    if (o > max) max = o;
  }
  return Math.min(Math.max(max, 0), 1);
}

/** Full-screen HTML overlay (sibling of the canvas, same pattern as `CutFade`) that briefly dims to
 * black at each Evolution-scene era boundary, standing in for the old hard camera-cut between exterior
 * train models — the passenger's view goes dark for a beat while the cabin around them changes. */
export function EvolutionEraFade() {
  const elapsed = useSyncExternalStore(timelineStore.subscribe, timelineStore.getElapsed);
  const local = sceneLocalAt("evolution", elapsed);
  const opacity = local >= 0 && local <= EVOLUTION_DURATION ? darknessAt(local) : 0;
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}
