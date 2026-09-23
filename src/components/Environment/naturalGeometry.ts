import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../../materials/noise";

/**
 * Landscape props, built as single merged geometries carrying their own vertex colours.
 *
 * Every tree in the film used to be one cone on one cylinder in one flat green, every hill a
 * sphere and every mountain a four-sided cone. At the distances these are seen, silhouette is
 * essentially the whole of the read: a cone reads as a cone however it is lit, and a horizon made
 * of them reads as a chart, not a landscape.
 *
 * Merging trunk and canopy into one geometry rather than instancing them separately matters for
 * more than tidiness — it halves the draw calls, keeps the two parts from ever drifting out of
 * alignment, and lets `ScrollField`'s per-instance colour jitter tint a whole tree at once (three
 * multiplies the instance colour into the vertex colour, so the brown stays brown while the green
 * shifts). The shapes themselves are generated from a seeded PRNG, so the same forest appears on
 * every machine and every reload.
 */

/** Fills a geometry's vertex colours with one flat colour, so merged parts keep their own material. */
function paint(geometry: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/** Merged parts must agree on which attributes exist, and the cheap primitives carry no tangents. */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Flat-shaded on purpose: expanding to per-face vertices is what gives the canopy tiers and the
  // ridge faces their distinct planes instead of one soft gradient. Icosahedra arrive non-indexed
  // already, and `toNonIndexed` warns rather than no-ops on those.
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

const cache = new Map<string, THREE.BufferGeometry>();

function shared(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const existing = cache.get(key);
  if (existing) return existing;
  const geometry = factory();
  cache.set(key, geometry);
  return geometry;
}

/**
 * A spruce: a bare lower trunk under three narrowing tiers of branches.
 *
 * The tiers are what separate a conifer from a traffic cone. Each one is drawn slightly wider than
 * the base of the one above so the profile steps rather than tapering smoothly, and each is a
 * shade lighter going up, because new growth at the crown is lighter than shaded old needles below.
 * Sits with its base at y = 0, so a field only has to place it on the ground.
 */
export function coniferGeometry(): THREE.BufferGeometry {
  return shared("conifer", () => {
    const rand = mulberry32(101);
    const parts: THREE.BufferGeometry[] = [paint(new THREE.CylinderGeometry(0.07, 0.13, 1.1, 6).translate(0, 0.55, 0), "#4a3726")];
    const tiers: [number, number, number, string][] = [
      [0.98, 1.35, 1.15, "#2f4b29"],
      [0.74, 1.2, 1.85, "#37582f"],
      [0.46, 1.05, 2.5, "#446a39"],
    ];
    for (const [radius, height, y, color] of tiers) {
      const cone = new THREE.ConeGeometry(radius, height, 8, 1);
      // A touch of lean and twist per tier: a tree that grew, not one that was placed.
      cone.rotateY(rand() * Math.PI);
      cone.rotateZ((rand() - 0.5) * 0.09);
      parts.push(paint(cone.translate(0, y, 0), color));
    }
    return merge(parts);
  });
}

/**
 * A broadleaf: a short trunk under a canopy of three overlapping faceted blobs.
 *
 * Icosahedra rather than spheres, because a low-facet canopy catches the key light in distinct
 * planes — which is how a real crown of leaves reads at distance — where a smooth sphere shades
 * into a single soft gradient and looks like a balloon.
 */
export function broadleafGeometry(): THREE.BufferGeometry {
  return shared("broadleaf", () => {
    const rand = mulberry32(202);
    const parts: THREE.BufferGeometry[] = [paint(new THREE.CylinderGeometry(0.09, 0.16, 1.3, 6).translate(0, 0.65, 0), "#54412c")];
    const blobs: [number, number, number, number, string][] = [
      [0.95, 0, 1.75, 0, "#3f5f33"],
      [0.66, 0.52, 2.2, 0.2, "#4a6d3a"],
      [0.6, -0.4, 2.05, -0.35, "#36542c"],
    ];
    for (const [radius, x, y, z, color] of blobs) {
      const blob = new THREE.IcosahedronGeometry(radius, 0);
      blob.rotateY(rand() * Math.PI);
      blob.scale(1, 0.82, 1);
      parts.push(paint(blob.translate(x, y, z), color));
    }
    return merge(parts);
  });
}

/** Low scrub for trackside verges — one squashed faceted blob, base at y = 0. */
export function bushGeometry(): THREE.BufferGeometry {
  return shared("bush", () => {
    const blob = new THREE.IcosahedronGeometry(0.5, 0);
    blob.scale(1.25, 0.72, 1.25);
    return merge([paint(blob.translate(0, 0.34, 0), "#405c32")]);
  });
}

/**
 * Displaces a revolved primitive radially by a smooth per-angle function, so its silhouette stops
 * being a perfect circle in plan — which is the single thing that makes a cone read as a cone and a
 * sphere read as a sphere however far away they are.
 */
function roughen(geometry: THREE.BufferGeometry, seed: number, amount: number, verticalAmount = 0): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  // Three overlapping angular waves: enough to be irregular, few enough to stay smooth.
  const waves = Array.from({ length: 3 }, (_, i) => ({ freq: 2 + i * 2 + Math.floor(rand() * 2), phase: rand() * Math.PI * 2, amp: amount / (i + 1.4) }));
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const angle = Math.atan2(z, x);
    let k = 0;
    for (const w of waves) k += Math.sin(angle * w.freq + w.phase) * w.amp;
    position.setX(i, x * (1 + k));
    position.setZ(i, z * (1 + k));
    if (verticalAmount !== 0) position.setY(i, y * (1 + k * verticalAmount));
  }
  position.needsUpdate = true;
  return geometry;
}

/** Paints a vertical colour ramp with a broken transition — a snowline, or a treeline on a hill. */
function paintByHeight(geometry: THREE.BufferGeometry, low: THREE.ColorRepresentation, high: THREE.ColorRepresentation, line: number, softness: number, seed: number): THREE.BufferGeometry {
  const rand = mulberry32(seed);
  const lowColor = new THREE.Color(low);
  const highColor = new THREE.Color(high);
  const mixed = new THREE.Color();
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < position.count; i++) {
    min = Math.min(min, position.getY(i));
    max = Math.max(max, position.getY(i));
  }

  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = (position.getY(i) - min) / Math.max(max - min, 1e-5);
    // A snowline that follows a contour exactly looks painted on; the jitter breaks it into drifts.
    const jitter = (rand() - 0.5) * softness;
    const blend = THREE.MathUtils.smoothstep(t + jitter, line - softness, line + softness);
    mixed.copy(lowColor).lerp(highColor, blend);
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

/**
 * A mountain: a ridged peak with snow on its upper slopes.
 *
 * The backdrop was four-sided cones — a shape that never occurs in a landscape and that reads,
 * unmistakably, as a primitive. This is the same silhouette budget spent on an irregular profile
 * and a broken snowline instead, which is most of what distinguishes a mountain range at eight
 * hundred metres from a row of tents. Authored one unit tall with its base at y = 0.
 */
export function ridgeGeometry(): THREE.BufferGeometry {
  return shared("ridge", () => {
    const cone = new THREE.ConeGeometry(1, 1.7, 11, 3);
    cone.translate(0, 0.85, 0);
    roughen(cone, 303, 0.3, 0.12);
    return merge([paintByHeight(cone, "#6f7c89", "#e9eef4", 0.66, 0.13, 404)]);
  });
}

/**
 * A rolling hill: a squashed dome, lumpy in plan, its crown grazed lighter than its flanks.
 *
 * Unit radius with its base at y = 0 — so unlike the sphere it replaces, a hill sits *on* the
 * ground rather than having to be sunk into it by eye.
 */
export function hillGeometry(): THREE.BufferGeometry {
  return shared("hill", () => {
    const dome = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, 0.55, 1);
    roughen(dome, 505, 0.16, 0.5);
    return merge([paintByHeight(dome, "#5f7a50", "#83975f", 0.55, 0.3, 606)]);
  });
}
