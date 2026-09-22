import { useSyncExternalStore } from "react";
import { narration } from "../../audio/NarrationEngine";

/**
 * Subtitle for the spoken commentary. Always on while the voice-over is enabled, so the narration
 * still reads with the sound off, on a browser with no speech voices, or for a viewer who can't
 * hear it — it sits above the transport and clears itself between lines.
 */
export function NarrationCaption() {
  const caption = useSyncExternalStore(narration.subscribe, narration.getCaption);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "0 clamp(16px, 6cqw, 64px) clamp(78px, 17cqh, 170px)",
        boxSizing: "border-box",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: "min(640px, 100%)",
          padding: "10px 18px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.42)",
          color: "#f5f5f0",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          fontSize: "clamp(13px, 1.9cqw, 20px)",
          lineHeight: 1.5,
          textAlign: "center",
          textShadow: "0 2px 10px rgba(0,0,0,0.75)",
          opacity: caption ? 1 : 0,
          transition: "opacity 0.35s ease",
        }}
      >
        {caption || "\u00a0"}
      </div>
    </div>
  );
}
