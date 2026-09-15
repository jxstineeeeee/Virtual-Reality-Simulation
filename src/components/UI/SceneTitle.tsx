import { useSyncExternalStore } from "react";
import { timelineStore } from "../../state/timelineStore";
import { getSceneLocal, fadeIn, fadeWindow, TOTAL_DURATION } from "../../timeline/timeline";
import { getEraAtTime } from "../../data/timeline";

const FINAL_CARD_START = TOTAL_DURATION - 6; // after the final step-off prompt has faded

/** Persistent brand label + a title banner at the start of every scene (era sub-titles during Evolution),
 * ending on a final cinematic title card as the film closes. */
export function SceneTitle() {
  const elapsed = useSyncExternalStore(timelineStore.subscribe, timelineStore.getElapsed);
  const { scene, local } = getSceneLocal(elapsed);

  let bannerText = scene.title;
  let bannerOpacity = fadeWindow(elapsed, scene.start, Math.min(scene.start + 4, scene.end), 0.8);

  if (scene.id === "evolution") {
    const era = getEraAtTime(local);
    bannerText = era.title;
    bannerOpacity = fadeWindow(local, era.start, Math.min(era.start + 3, era.end), 0.6);
  }

  const finalOpacity = fadeIn(elapsed, FINAL_CARD_START, 2.5);
  if (elapsed >= FINAL_CARD_START) bannerOpacity = 0;
  const brandOpacity = 1 - finalOpacity;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "#f5f5f0",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        textShadow: "0 2px 12px rgba(0,0,0,0.6)",
      }}
    >
      {/* Persistent brand label */}
      <div
        style={{
          marginTop: "clamp(16px, 4cqh, 40px)",
          fontSize: "clamp(12px, 1.6cqw, 16px)",
          fontWeight: 600,
          letterSpacing: "0.35em",
          opacity: brandOpacity * 0.85,
          transition: "opacity 0.3s linear",
        }}
      >
        TRAIN EVOLUTION
      </div>

      {/* Per-scene / per-era title banner */}
      <div
        style={{
          marginTop: "auto",
          marginBottom: "clamp(64px, 14cqh, 140px)",
          fontSize: "clamp(24px, 5cqw, 48px)",
          fontWeight: 700,
          letterSpacing: "0.18em",
          opacity: bannerOpacity,
        }}
      >
        {bannerText}
      </div>

      {/* Final cinematic title card */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "18px",
          opacity: finalOpacity,
        }}
      >
        <div style={{ fontSize: "clamp(36px, 8cqw, 84px)", fontWeight: 800, letterSpacing: "0.16em" }}>
          TRAIN EVOLUTION
        </div>
        <div style={{ fontSize: "clamp(16px, 2.6cqw, 26px)", fontWeight: 400, letterSpacing: "0.3em", opacity: 0.85 }}>
          FROM STEAM TO SPEED
        </div>
      </div>
    </div>
  );
}
