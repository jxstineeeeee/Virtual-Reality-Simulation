import { TOTAL_DURATION } from "../timeline/timeline";

type Listener = () => void;

/**
 * Minimal external store for the cinematic clock.
 * - `tick` is driven from inside the R3F render loop (useFrame) for smooth,
 *   render-independent animation of meshes/camera.
 * - UI components subscribe via useSyncExternalStore so text/progress bar
 *   updates without forcing the whole scene graph to re-render through React.
 */
class TimelineStore {
  private elapsed = 0;
  private playing = false;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) listener();
  }

  getElapsed = (): number => this.elapsed;
  getPlaying = (): boolean => this.playing;

  play = () => {
    if (this.elapsed >= TOTAL_DURATION) {
      this.elapsed = 0;
    }
    this.playing = true;
    this.notify();
  };

  pause = () => {
    this.playing = false;
    this.notify();
  };

  restart = () => {
    this.elapsed = 0;
    this.playing = true;
    this.notify();
  };

  /** Advance the clock by `delta` seconds. No-op while paused. */
  tick = (delta: number) => {
    if (!this.playing) return;
    this.elapsed += delta;
    if (this.elapsed >= TOTAL_DURATION) {
      this.elapsed = TOTAL_DURATION;
      this.playing = false;
    }
    this.notify();
  };
}

export const timelineStore = new TimelineStore();
