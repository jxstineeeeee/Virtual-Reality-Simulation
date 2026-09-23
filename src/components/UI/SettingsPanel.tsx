import { useSyncExternalStore, type CSSProperties } from "react";
import { settingsStore } from "../../state/settingsStore";
import { autoTier, type QualityChoice } from "../../effects/renderQuality";
import type { CameraMode } from "../../state/settingsStore";

const FONT = "'Segoe UI', system-ui, sans-serif";

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.14em",
  color: "rgba(255,255,255,0.62)",
};

const segmentStyle = (active: boolean): CSSProperties => ({
  padding: "7px 13px",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.1em",
  fontFamily: FONT,
  color: active ? "#12130f" : "rgba(255,255,255,0.8)",
  background: active ? "rgba(245,245,240,0.94)" : "rgba(255,255,255,0.09)",
  border: "none",
  borderRadius: 999,
  cursor: "pointer",
});

const noteStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.45,
  color: "rgba(255,255,255,0.45)",
  margin: 0,
};

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (next: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((option) => (
        <button key={option.value} style={segmentStyle(option.value === value)} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface SettingsPanelProps {
  onClose: () => void;
  split: boolean;
  onToggleSplit: () => void;
  muted: boolean;
  onToggleMuted: () => void;
  voiceOver: boolean;
  onToggleVoiceOver: () => void;
  onRestart: () => void;
}

/**
 * Everything that used to sit permanently across the bottom of the frame, plus the two settings
 * there was previously no way to reach at all.
 *
 * The transport bar had grown to six buttons, all of them visible for the whole five minutes and
 * all of them in front of the film. Only play/pause is wanted mid-viewing; the rest are decisions
 * you make once. Putting them behind one control is what gets the picture back.
 */
export function SettingsPanel({ onClose, split, onToggleSplit, muted, onToggleMuted, voiceOver, onToggleVoiceOver, onRestart }: SettingsPanelProps) {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);

  return (
    <div
      // `lookInput` reads drags anywhere on the page as head-turning; this marks the panel as UI so
      // a finger sliding across a setting does not also swing the camera behind it.
      data-ui-panel=""
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(8,9,11,0.55)",
        backdropFilter: "blur(6px)",
        pointerEvents: "auto",
        zIndex: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(420px, calc(100% - 32px))",
          maxHeight: "calc(100% - 32px)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          padding: "22px 24px 24px",
          borderRadius: 18,
          background: "rgba(18,20,24,0.92)",
          border: "1px solid rgba(255,255,255,0.1)",
          fontFamily: FONT,
          color: "#f5f5f0",
        }}
      >
        <div style={{ ...rowStyle, flexWrap: "nowrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.2em" }}>SETTINGS</span>
          <button
            style={{ ...segmentStyle(false), padding: "6px 11px", fontSize: 13, lineHeight: 1 }}
            onClick={onClose}
            aria-label="Close settings"
          >
            {"✕"}
          </button>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>QUALITY</span>
          <Segmented<QualityChoice>
            value={settings.quality}
            options={[
              { value: "auto", label: "AUTO" },
              { value: "low", label: "LOW" },
              { value: "medium", label: "MEDIUM" },
              { value: "high", label: "HIGH" },
            ]}
            onChange={(next) => settingsStore.set("quality", next)}
          />
        </div>
        <p style={noteStyle}>
          Turns down resolution, antialiasing, shadows and the blur passes. Auto picks{" "}
          <strong style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}>{autoTier}</strong> on this device. Surface texture
          detail is fixed when the page loads, so reload to have a change apply to that too.
        </p>

        <div style={rowStyle}>
          <span style={labelStyle}>CAMERA</span>
          <Segmented<CameraMode>
            value={settings.camera}
            options={[
              { value: "calm", label: "CALM" },
              { value: "cinematic", label: "CINEMATIC" },
            ]}
            onChange={(next) => settingsStore.set("camera", next)}
          />
        </div>
        <p style={noteStyle}>
          Calm looks where you are walking and nowhere else, so you turn your own head. Cinematic lets each scene turn it for you.
        </p>

        <div style={rowStyle}>
          <span style={labelStyle}>NARRATION</span>
          <Segmented<string>
            value={voiceOver ? "on" : "off"}
            options={[
              { value: "on", label: "ON" },
              { value: "off", label: "OFF" },
            ]}
            onChange={(next) => {
              if ((next === "on") !== voiceOver) onToggleVoiceOver();
            }}
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>SOUND</span>
          <Segmented<string>
            value={muted ? "off" : "on"}
            options={[
              { value: "on", label: "ON" },
              { value: "off", label: "OFF" },
            ]}
            onChange={(next) => {
              if ((next === "on") === muted) onToggleMuted();
            }}
          />
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>VIEW</span>
          <Segmented<string>
            value={split ? "two" : "one"}
            options={[
              { value: "one", label: "1 SCREEN" },
              { value: "two", label: "2 SCREENS" },
            ]}
            onChange={(next) => {
              if ((next === "two") !== split) onToggleSplit();
            }}
          />
        </div>

        <button
          style={{ ...segmentStyle(false), padding: "10px 14px", letterSpacing: "0.15em" }}
          onClick={() => {
            onRestart();
            onClose();
          }}
        >
          RESTART THE FILM
        </button>
      </div>
    </div>
  );
}
