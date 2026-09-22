import { useSyncExternalStore } from "react";
import { timelineStore } from "../../state/timelineStore";
import { SCENES, sceneTimeAt } from "../../timeline/timeline";
import { FIRST_ARRIVAL_EXIT_CUT } from "../../scenes/ExteriorRideScene";
import { ARRIVAL_EXIT_CUT } from "../../scenes/ArrivalScene";

const FADE_IN = 0.15;
const FADE_OUT = 0.35;

/** Cuts inside a scene: from an arriving cabin's interior to standing in the train's open doorway.
 * Both constants are in their scene's design seconds, so they go through `sceneTimeAt` to land on
 * the clock at the same instant the picture actually cuts. */
const MID_SCENE_CUTS = [
  sceneTimeAt("exteriorRide", FIRST_ARRIVAL_EXIT_CUT),
  sceneTimeAt("arrival", ARRIVAL_EXIT_CUT),
];
const CUT_TIMES = [...SCENES.filter((s) => s.hardCut && s.start !== 0).map((s) => s.start), ...MID_SCENE_CUTS];

/** A quick flash-to-black at every hard cut, so location jumps read as a deliberate edit. */
function cutOpacity(elapsed: number): number {
  let max = 0;
  for (const cut of CUT_TIMES) {
    const d = elapsed - cut;
    if (d < -FADE_IN || d > FADE_OUT) continue;
    const o = d < 0 ? 1 - Math.abs(d) / FADE_IN : 1 - d / FADE_OUT;
    if (o > max) max = o;
  }
  return Math.min(Math.max(max, 0), 1);
}

export function CutFade() {
  const elapsed = useSyncExternalStore(timelineStore.subscribe, timelineStore.getElapsed);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#000",
        opacity: cutOpacity(elapsed),
        pointerEvents: "none",
      }}
    />
  );
}
