import type { QualityChoice } from "../effects/renderQuality";

type Listener = () => void;

/**
 * How the camera behaves.
 *
 * "cinematic" is the original: every scene's keyframes drive both where the camera stands *and*
 * where it looks, so the film turns your head for you — out of the window, up at the ceiling, round
 * to the door. "calm" keeps the blocking that moves you through the story but hands the looking
 * back to the viewer: the gaze follows the direction you are actually travelling in, and nothing
 * else moves it. It is the difference between being shown the train and being on it.
 */
export type CameraMode = "calm" | "cinematic";

export interface Settings {
  quality: QualityChoice;
  camera: CameraMode;
}

const STORAGE_KEY = "trainEvolution.settings";

const DEFAULTS: Settings = {
  quality: "auto",
  // Calm by default: the scripted gaze is disorienting on a phone in a headset, which is the
  // viewing position this whole project is built around.
  camera: "calm",
};

function load(): Settings {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      quality: parsed.quality ?? DEFAULTS.quality,
      camera: parsed.camera ?? DEFAULTS.camera,
    };
  } catch {
    // A corrupt or unreadable store is not worth failing the film over.
    return { ...DEFAULTS };
  }
}

/**
 * Viewer preferences, kept outside React for the same reason `timelineStore` is: the camera reads
 * the mode every frame from inside `useFrame`, and re-rendering the scene graph sixty times a second
 * to deliver a value that changes twice a session would be absurd. The UI subscribes; the render
 * loop just reads.
 */
class SettingsStore {
  private settings: Settings = load();
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Stable snapshot — the same object identity until something actually changes, so
   * `useSyncExternalStore` does not spin. */
  get = (): Settings => this.settings;

  getQuality = (): QualityChoice => this.settings.quality;
  getCamera = (): CameraMode => this.settings.camera;

  set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    if (this.settings[key] === value) return;
    this.settings = { ...this.settings, [key]: value };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Private browsing, quota, a disabled store — the setting still applies for this session.
    }
    for (const listener of this.listeners) listener();
  };
}

export const settingsStore = new SettingsStore();
