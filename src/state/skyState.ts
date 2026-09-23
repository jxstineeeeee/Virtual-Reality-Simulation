import * as THREE from "three";

/**
 * The sky, as data.
 *
 * `GlobalAtmosphere` and `EvolutionScene` each own the look of their own scenes and each eases
 * toward their own palette on their own clock, but both need to describe the *same* sky — and
 * `SkyDome`, which draws it, is mounted once above them both. Rather than prop-drill a changing
 * colour through the scene tree sixty times a second (which would re-render it sixty times a
 * second), whichever atmosphere is active writes into this object each frame and the dome reads it.
 *
 * Same pattern, and for the same reason, as [journeyEnvironmentState].
 */
export interface SkyState {
  /** Colour at the horizon. Always kept equal to the fog colour, so terrain fogs into sky seamlessly. */
  horizon: THREE.Color;
  /** Colour overhead. */
  zenith: THREE.Color;
  /** Colour of the sun disc and the glow around it — the key light's own colour. */
  sun: THREE.Color;
  /** Unit vector toward the sun, matching the directional light's position. */
  sunDirection: THREE.Vector3;
  /** 0 = clear blue, 1 = solid overcast. */
  cloudCover: number;
  /** Overall multiplier. Tunnels and dark-outs pull this down without disturbing the palette. */
  dim: number;
}

export const skyState: SkyState = {
  horizon: new THREE.Color("#bcd9f0"),
  zenith: new THREE.Color("#4f8fd0"),
  sun: new THREE.Color("#fff6e8"),
  sunDirection: new THREE.Vector3(10, 16, 8).normalize(),
  cloudCover: 0.35,
  dim: 1,
};
