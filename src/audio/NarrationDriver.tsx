import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { timelineStore } from "../state/timelineStore";
import { narration } from "./NarrationEngine";
import { NARRATION } from "./narrationScript";

/**
 * Fires each voice-over line off the master clock, the same way `AudioDriver` walks its sound cues:
 * one moving index through a sorted list, reset whenever the viewer restarts or seeks backwards so
 * the narrator never replays a backlog of lines at once.
 */
export function NarrationDriver() {
  const index = useRef(0);
  const prevElapsed = useRef(0);

  useFrame(() => {
    const playing = timelineStore.getPlaying();
    narration.setPlaying(playing);
    if (!playing) return;

    const elapsed = timelineStore.getElapsed();
    if (elapsed < prevElapsed.current) {
      narration.stop();
      const next = NARRATION.findIndex((line) => line.t > elapsed);
      index.current = next < 0 ? NARRATION.length : next;
    }
    prevElapsed.current = elapsed;

    // Only the most recent due line is spoken: a long pause or a dropped frame can leave two behind,
    // and hearing the older one would put the commentary out of step with the picture.
    let due = -1;
    while (index.current < NARRATION.length && NARRATION[index.current].t <= elapsed) due = index.current++;
    if (due >= 0) narration.speak(NARRATION[due]);
  });

  return null;
}
