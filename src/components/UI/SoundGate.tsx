import { useState } from "react";
import { trainAudio } from "../../audio/TrainAudioEngine";
import { narration } from "../../audio/NarrationEngine";
import { lookInput } from "../Camera/lookInput";
import { timelineStore } from "../../state/timelineStore";

const isIOS =
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPads report themselves as desktop Safari, so they only give themselves away by having a touchscreen.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/**
 * The start screen: one tap that asks for the two permissions a phone will not grant without being
 * asked — the audio session (browsers refuse to make a sound until the viewer has interacted) and
 * motion access for the gyro look (iOS only prompts inside a tap).
 *
 * It stays up until `trainAudio.unlock()` confirms the audio graph is really running, so a phone that
 * silently refused — the usual cause being the iOS side switch set to Silent — says so and offers
 * another go, instead of playing the whole cinematic in silence the way the bare PLAY button did.
 */
export function SoundGate() {
  const [dismissed, setDismissed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  if (dismissed) return null;

  const enter = async (withSound: boolean) => {
    setBusy(true);
    void lookInput.enableMotion(); // fired first: iOS only shows the motion prompt inside the tap itself
    // Speech synthesis has the same gesture requirement as the audio graph, so the narrator is
    // warmed up here too rather than at its first line, minutes in.
    if (withSound) narration.prime();
    if (!withSound) {
      // Carrying on without sound means without the voice as well; its captions stay available from
      // the transport's VOICE button.
      narration.setEnabled(false);
      // Left un-unlocked rather than muted: with no AudioContext the engine is already a no-op, and
      // the transport's own PLAY still unlocks it if the viewer changes their mind.
      setDismissed(true);
      timelineStore.play();
      return;
    }
    const running = await trainAudio.unlock();
    setBusy(false);
    if (!running) {
      setBlocked(true);
      return;
    }
    setDismissed(true);
    timelineStore.play();
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        padding: "32px 20px",
        boxSizing: "border-box",
        overflow: "hidden",
        textAlign: "center",
        background: "radial-gradient(circle at 50% 40%, #1c1a17 0%, #000 75%)",
        color: "#f5f5f0",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "100%",
          fontSize: "clamp(16px, 5.6vw, 34px)",
          fontWeight: 700,
          letterSpacing: "0.24em",
        }}
      >
        TRAIN EVOLUTION
      </div>
      <p style={{ margin: 0, maxWidth: "min(420px, 100%)", fontSize: "clamp(13px, 3.6vw, 15px)", lineHeight: 1.6, color: "rgba(245,245,240,0.75)" }}>
        {blocked
          ? "Your phone blocked the sound."
          : "This is a cinematic with sound. Your browser needs one tap before it will play any audio, and phones need permission to use motion for the 360\u00b0 look."}
      </p>
      {blocked && (
        <p style={{ margin: 0, maxWidth: "min(420px, 100%)", fontSize: "clamp(13px, 3.6vw, 15px)", lineHeight: 1.6, color: "#ffd479" }}>
          {isIOS
            ? "Flick the side switch off Silent (or turn off Do Not Disturb / Silent Mode in Control Centre), turn the volume up, then tap again."
            : "Turn your media volume up, make sure this site is not muted in your browser tab, then tap again."}
        </p>
      )}
      <button
        onClick={() => void enter(true)}
        disabled={busy}
        style={{
          marginTop: 6,
          maxWidth: "100%",
          padding: "16px clamp(18px, 6vw, 34px)",
          fontSize: "clamp(12px, 3.6vw, 15px)",
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: "#0d0d0d",
          background: "rgba(245,245,240,0.94)",
          border: "none",
          borderRadius: 999,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {blocked ? "\u{1F50A} TRY AGAIN" : "\u{1F50A} ALLOW SOUND"}
      </button>
      <button
        onClick={() => void enter(false)}
        style={{
          maxWidth: "100%",
          padding: "8px 16px",
          fontSize: 12,
          letterSpacing: "0.12em",
          color: "rgba(245,245,240,0.6)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          textDecoration: "underline",
        }}
      >
        CONTINUE WITHOUT SOUND
      </button>
    </div>
  );
}
