import * as THREE from "three";

type Listener = () => void;

const DEG = Math.PI / 180;
/** Desktop mouse: a comfortable "look around from your seat" range around the scripted gaze. */
const MOUSE_YAW_MAX = 60 * DEG;
const MOUSE_PITCH_MAX = 30 * DEG;
/** Finger drag: unlimited turning (full 360°), pitch clamped short of straight up/down. */
const DRAG_YAW_PER_SCREEN_WIDTH = 1.2 * Math.PI;
const DRAG_PITCH_PER_SCREEN_HEIGHT = 0.6 * Math.PI;
const DRAG_PITCH_MAX = 80 * DEG;

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
/** Device frame looks out of the screen's back along -Z once tilted -90° about X (same as three's old DeviceOrientationControls). */
const X_MINUS_90 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

type PermissionedOrientationEvent = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };

function screenAngle(): number {
  const angle = screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
  return angle * DEG;
}

/**
 * Every way the viewer can turn their head, in one place: desktop mouse position, finger drag, and
 * phone gyro (full 360°). `CameraDirector` composes these on top of each scene's scripted gaze, so the
 * cinematic still points you at the action and "forward" follows the story while you look anywhere.
 * A module singleton (like `timelineStore`) so the PLAY button can request motion permission and the
 * RECENTER button can reset it without threading refs through React.
 */
class LookInput {
  /** Mouse target offsets; the camera damps toward them. */
  mouseYaw = 0;
  mousePitch = 0;
  /** Accumulated finger-drag offsets. */
  dragYaw = 0;
  dragPitch = 0;

  private deviceQuat = new THREE.Quaternion();
  private gyroActive = false;
  private referenceYaw: number | null = null;
  private listeningMotion = false;
  private touch: { id: number; x: number; y: number } | null = null;
  private listeners = new Set<Listener>();
  private euler = new THREE.Euler();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();

  constructor() {
    if (typeof window === "undefined") return;
    window.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    // Listen from the start: browsers that need no permission (Android) deliver readings right away,
    // and where permission is required (iOS) the listener stays silent until `enableMotion()` is granted.
    this.listenMotion();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getGyroActive = (): boolean => this.gyroActive;

  /** Must be called straight from a user gesture — iOS only shows its motion prompt inside a tap. */
  enableMotion = async () => {
    const DOE = window.DeviceOrientationEvent as PermissionedOrientationEvent | undefined;
    if (!DOE) return;
    if (typeof DOE.requestPermission === "function") {
      try {
        if ((await DOE.requestPermission()) !== "granted") return;
      } catch {
        return;
      }
    }
    this.listenMotion();
  };

  /** Make the phone's current heading (and zero drag) "straight ahead" again. */
  recenter = () => {
    this.referenceYaw = null;
    this.dragYaw = 0;
    this.dragPitch = 0;
  };

  /** Writes the phone's orientation, relative to the recentered heading, into `out`. False without a gyro. */
  readDeviceQuaternion(out: THREE.Quaternion): boolean {
    if (!this.gyroActive) return false;
    out.copy(this.deviceQuat);
    return true;
  }

  private listenMotion() {
    if (this.listeningMotion) return;
    this.listeningMotion = true;
    window.addEventListener("deviceorientation", this.onOrientation);
  }

  private onOrientation = (e: DeviceOrientationEvent) => {
    // Desktops fire one event with nulls — only a real sensor reading turns gyro look on.
    if (e.alpha === null || e.beta === null || e.gamma === null) return;
    this.euler.set(e.beta * DEG, e.alpha * DEG, -e.gamma * DEG, "YXZ");
    const q = this.q.setFromEuler(this.euler).multiply(X_MINUS_90);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -screenAngle()));

    const forward = this.v.set(0, 0, -1).applyQuaternion(q);
    const yaw = Math.atan2(-forward.x, -forward.z);
    if (this.referenceYaw === null) this.referenceYaw = yaw;
    this.deviceQuat.setFromAxisAngle(Y_AXIS, -this.referenceYaw).multiply(q);

    if (!this.gyroActive) {
      this.gyroActive = true;
      for (const listener of this.listeners) listener();
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || this.touch) return;
    if ((e.target as Element | null)?.closest?.("button")) return;
    this.touch = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "mouse") {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      this.mouseYaw = -nx * MOUSE_YAW_MAX;
      this.mousePitch = -ny * MOUSE_PITCH_MAX;
      return;
    }
    if (!this.touch || e.pointerId !== this.touch.id) return;
    // Drag the world: finger right turns the view left, finger down tilts it up.
    this.dragYaw += ((e.clientX - this.touch.x) / window.innerWidth) * DRAG_YAW_PER_SCREEN_WIDTH;
    if (!this.gyroActive) {
      const pitch = this.dragPitch + ((e.clientY - this.touch.y) / window.innerHeight) * DRAG_PITCH_PER_SCREEN_HEIGHT;
      this.dragPitch = THREE.MathUtils.clamp(pitch, -DRAG_PITCH_MAX, DRAG_PITCH_MAX);
    }
    this.touch.x = e.clientX;
    this.touch.y = e.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.touch && e.pointerId === this.touch.id) this.touch = null;
  };
}

export const lookInput = new LookInput();
