import { useEffect, useRef, useSyncExternalStore } from "react";
import { timelineStore } from "../../state/timelineStore";
import { SCENES } from "../../timeline/timeline";
import { publicAsset } from "../../assets/publicAsset";

const EVOLUTION_START = SCENES.find((s) => s.id === "evolution")!.start;

// A brief cinematic insert of real archival footage as the steam train pulls away for the last time,
// before the diesel arrives — "3D train -> real footage -> 3D train" per the brief, used sparingly (one
// ~2.6s beat in the whole cinematic) so it reads as a deliberate flourish, not a video collage.
const WINDOW_START = 3.2;
const FADE_IN_END = 3.8;
const FADE_OUT_START = 5.8;
const WINDOW_END = 6.4;
const VIDEO_SRC = publicAsset("/video/evolution/steam-cab-driver.webm");
const VIDEO_START_TIME = 25;

function overlayOpacity(local: number): number {
  if (local < WINDOW_START || local > WINDOW_END) return 0;
  if (local < FADE_IN_END) return (local - WINDOW_START) / (FADE_IN_END - WINDOW_START);
  if (local > FADE_OUT_START) return 1 - (local - FADE_OUT_START) / (WINDOW_END - FADE_OUT_START);
  return 1;
}

/**
 * Full-screen HTML overlay (sibling of the R3F canvas, like `CutFade`) that briefly cross-fades in
 * real steam-locomotive cab footage during the Evolution scene's steam era. Entirely additive: the
 * 3D scene underneath keeps running untouched, so if the clip is ever removed this just never shows.
 */
export function EvolutionFootageOverlay() {
  const elapsed = useSyncExternalStore(timelineStore.subscribe, timelineStore.getElapsed);
  const videoRef = useRef<HTMLVideoElement>(null);
  const local = elapsed - EVOLUTION_START;
  const active = local >= WINDOW_START && local <= WINDOW_END;
  const opacity = overlayOpacity(local);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (active) {
      if (video.paused) {
        video.currentTime = VIDEO_START_TIME;
        video.play().catch(() => {});
      }
    } else {
      video.pause();
    }
  }, [active]);

  if (opacity <= 0) return null;

  return (
    <div style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none", background: "#000" }}>
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        playsInline
        loop
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={(e) => {
          // Missing/broken asset: hide the element instead of showing a broken-video frame.
          (e.currentTarget as HTMLVideoElement).style.display = "none";
        }}
      />
    </div>
  );
}
