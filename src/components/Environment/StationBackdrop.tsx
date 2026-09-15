import { useRef } from "react";
import { Railway } from "./Railway";
import { Platform } from "./Platform";
import { Station } from "./Station";
import { Vegetation } from "./Vegetation";
import { TracksideProps } from "./TracksideProps";

interface StationBackdropProps {
  /** Fixed 0..1 "how modern the infrastructure looks" — no evolution animation, just a present-day look. */
  progress?: number;
}

/**
 * Bundles the station-vicinity environment (track, platform, station building, trees, fence/signal)
 * at a fixed present-day look. Reused by every scene that takes place at (or departing/arriving at)
 * the same station, so only the Evolution scene needs a live-animating progress value.
 */
export function StationBackdrop({ progress = 0.6 }: StationBackdropProps) {
  const progressRef = useRef(progress);
  progressRef.current = progress;

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
