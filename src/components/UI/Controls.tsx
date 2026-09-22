import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { timelineStore } from "../../state/timelineStore";
import { TOTAL_DURATION } from "../../timeline/timeline";
import { trainAudio } from "../../audio/TrainAudioEngine";
import { narration } from "../../audio/NarrationEngine";
import { lookInput } from "../Camera/lookInput";

const isTouchDevice = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function formatTime(seconds: number): string {
  const s = Math.floor(Math.max(seconds, 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const buttonStyle: CSSProperties = {
  padding: "10px clamp(12px, 3vw, 22px)",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.15em",
  color: "#0d0d0d",
  background: "rgba(245,245,240,0.92)",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
  fontFamily: "'Segoe UI', system-ui, sans-serif",
};

interface ControlsProps {
  split: boolean;
  onToggleSplit: () => void;
}

/** Minimal Play/Pause/Restart transport with a slim progress bar and a split-screen toggle. */
export function Controls({ split, onToggleSplit }: ControlsProps) {
  const elapsed = useSyncExternalStore(timelineStore.subscribe, timelineStore.getElapsed);
  const playing = useSyncExternalStore(timelineStore.subscribe, timelineStore.getPlaying);
  const gyroActive = useSyncExternalStore(lookInput.subscribe, lookInput.getGyroActive);
  const voiceOver = useSyncExternalStore(narration.subscribe, narration.getEnabled);
  const [muted, setMuted] = useState(false);
  const progress = Math.min(elapsed / TOTAL_DURATION, 1);
  const finished = elapsed >= TOTAL_DURATION;

  const handlePlay = () => {
    void lookInput.enableMotion(); // iOS only shows the motion-access prompt inside a tap
    // Browser autoplay policy: the audio has to be unlocked from inside the gesture. Normally the
    // start-up SoundGate has already done it; this covers the viewer who skipped sound there.
    void trainAudio.unlock();
    if (playing) timelineStore.pause();
    else timelineStore.play();
  };

  const handleMuteToggle = () => {
    const next = !muted;
    trainAudio.setMuted(next);
    // The narrator runs through the browser's speech synthesis, outside the train audio graph, so
    // the mute button has to silence it separately — otherwise a "muted" film still talks.
    narration.setMuted(next);
    setMuted(next);
  };

  const handleVoiceOverToggle = () => {
    const next = !voiceOver;
    // Turning it back on has to happen inside the tap: that is the only moment a phone will let
    // speech synthesis start.
    if (next) narration.prime();
    narration.setEnabled(next);
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "0 20px clamp(16px, 4vh, 32px)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "min(480px, 90%)",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          fontSize: 12,
          fontVariantNumeric: "tabular-nums",
          color: "rgba(255,255,255,0.85)",
          textShadow: "0 1px 4px rgba(0,0,0,0.6)",
        }}
      >
        <span>{formatTime(elapsed)}</span>
        <div
          style={{
            flex: 1,
            height: 4,
            background: "rgba(255,255,255,0.25)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: "#f5f5f0",
            }}
          />
        </div>
        <span>{formatTime(TOTAL_DURATION)}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, pointerEvents: "auto" }}>
        <button style={buttonStyle} onClick={handlePlay}>
          {finished ? "REPLAY" : playing ? "PAUSE" : "PLAY"}
        </button>
        <button style={buttonStyle} onClick={() => timelineStore.restart()}>
          RESTART
        </button>
        <button style={{ ...buttonStyle, minWidth: 44 }} onClick={handleMuteToggle}>
          {muted ? "\u{1F507}" : "\u{1F50A}"}
        </button>
        <button
          style={voiceOver ? buttonStyle : { ...buttonStyle, background: "rgba(245,245,240,0.4)" }}
          onClick={handleVoiceOverToggle}
          title={voiceOver ? "Turn the narration off" : "Turn the narration on"}
        >
          {voiceOver ? "VOICE ON" : "VOICE OFF"}
        </button>
        <button style={buttonStyle} onClick={onToggleSplit}>
          {split ? "1 SCREEN" : "2 SCREENS"}
        </button>
        {(gyroActive || isTouchDevice) && (
          <button style={buttonStyle} onClick={lookInput.recenter}>
            RECENTER
          </button>
        )}
      </div>
    </div>
  );
}
