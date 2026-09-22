/**
 * How far in front of the camera the shot is actually looking, in metres, written by
 * `CameraDirector` every frame and read by the depth-of-field pass.
 *
 * Depth of field is the difference between "a 3D scene" and "a photograph of one", but only if it
 * focuses on the subject. Every scene already names its subject — the `look` target its shot
 * function returns — so the focus distance is derived from that rather than hand-authored a second
 * time and left to drift out of agreement with the blocking.
 *
 * Same mutable-singleton pattern as `journeyEnvironmentState`: written and read inside the frame
 * loop, never through React state, so it costs no re-renders.
 */
export const cameraFocusState = {
  /** Distance from the camera to its look target, metres. */
  distance: 6,
};
