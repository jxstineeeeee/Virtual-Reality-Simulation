import * as THREE from "three";
import { tileable } from "./proceduralTextures";

/**
 * Fractal pattern generators.
 *
 * Until now `arc()` speckle was the only pattern source in the project, and a field of random
 * circles looks like exactly that: circles. Real surfaces — soil, rust, weathered concrete, cloud —
 * are fractal: a broad shape carrying the same kind of detail at every smaller scale. Producing that
 * is the difference between a texture that merely breaks up a flat fill and one that reads as a
 * material.
 *
 * Everything here tiles. The noise lattice wraps at a fixed period and each octave doubles that
 * period, so however many octaves are summed the edges still meet; the stone painter redraws any
 * stone that overhangs an edge on the opposite side. That matters because nearly every surface in
 * the film is a repeating detail map seen at a grazing angle, where a visible seam is obvious.
 */

/** Deterministic 32-bit PRNG, so a given texture looks the same on every load and every machine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash of a lattice point, wrapped to `period`. That wrap is the whole reason the noise tiles. */
function latticeHash(x: number, y: number, period: number, seed: number): number {
  const xi = ((x % period) + period) % period;
  const yi = ((y % period) + period) % period;
  let h = Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Quintic ease: smoother than smoothstep at the lattice lines, which otherwise show as a faint grid. */
function quintic(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function valueNoise(x: number, y: number, period: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = quintic(x - x0);
  const fy = quintic(y - y0);
  const a = latticeHash(x0, y0, period, seed);
  const b = latticeHash(x0 + 1, y0, period, seed);
  const c = latticeHash(x0, y0 + 1, period, seed);
  const d = latticeHash(x0 + 1, y0 + 1, period, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

export interface NoiseOptions {
  size?: number;
  /** Lattice cells across the texture at the first octave. Higher = finer base pattern. */
  cells?: number;
  octaves?: number;
  /** Amplitude falloff per octave. Lower is smoother, higher is grittier. */
  gain?: number;
  seed?: number;
  /** Dark end and light end of the colour ramp the noise is mapped through. */
  low?: string;
  high?: string;
  /** Pushes the histogram toward the extremes. 1 leaves it linear. */
  contrast?: number;
  /** Folds the noise about its midpoint — smooth blobs become creased veins and cracks. */
  ridged?: boolean;
  /** Squash factors, for directional grain and flow. */
  stretchX?: number;
  stretchY?: number;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Raw fBm field in 0..1, before any colour ramp — shared by the canvas painters below. */
function noiseField({
  size = 256,
  cells = 4,
  octaves = 5,
  gain = 0.5,
  seed = 1,
  contrast = 1,
  ridged = false,
  stretchX = 1,
  stretchY = 1,
}: NoiseOptions): Float32Array {
  const field = new Float32Array(size * size);
  let min = Infinity;
  let max = -Infinity;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let amp = 1;
      let total = 0;
      let period = cells;
      for (let o = 0; o < octaves; o++) {
        // The sample point and the wrap period scale together, so every octave tiles.
        let n = valueNoise((x / size) * period * stretchX, (y / size) * period * stretchY, Math.max(Math.round(period), 1), seed + o * 97);
        if (ridged) n = 1 - Math.abs(n * 2 - 1);
        sum += n * amp;
        total += amp;
        amp *= gain;
        period *= 2;
      }
      const v = sum / total;
      field[y * size + x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  // Normalise, then apply contrast about the midpoint. Summed octaves average toward 0.5, and
  // without this every noise texture comes out the same washed-out grey whatever its settings.
  const span = Math.max(max - min, 1e-5);
  for (let i = 0; i < field.length; i++) {
    let v = (field[i] - min) / span;
    if (contrast !== 1) v = Math.min(Math.max((v - 0.5) * contrast + 0.5, 0), 1);
    field[i] = v;
  }
  return field;
}

/** Tileable fBm painted through a two-colour ramp. The workhorse behind dirt, rust and concrete. */
export function createNoiseCanvas(options: NoiseOptions = {}): HTMLCanvasElement {
  const size = options.size ?? 256;
  const field = noiseField({ ...options, size });
  const [lr, lg, lb] = parseHex(options.low ?? "#3a3a3a");
  const [hr, hg, hb] = parseHex(options.high ?? "#d0d0d0");

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < field.length; i++) {
    const v = field[i];
    image.data[i * 4] = lr + (hr - lr) * v;
    image.data[i * 4 + 1] = lg + (hg - lg) * v;
    image.data[i * 4 + 2] = lb + (hb - lb) * v;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/** `createNoiseCanvas` as a ready-to-use texture. */
export function createNoiseTexture(options: NoiseOptions & { isColor?: boolean } = {}): THREE.CanvasTexture {
  return tileable(createNoiseCanvas(options), options.isColor ?? true);
}

/**
 * Composites one pattern canvas over another.
 *
 * Natural surfaces carry detail at scales an octave stack cannot span in one pass — broad damp
 * patches *and* individual grains. Painting the fine layer over the coarse one is far cheaper than
 * one enormous noise field carrying both, and lets each layer be tuned on its own.
 */
export function overlayCanvas(base: HTMLCanvasElement, overlay: HTMLCanvasElement, alpha: number, mode: GlobalCompositeOperation = "overlay"): HTMLCanvasElement {
  const ctx = base.getContext("2d")!;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = mode;
  ctx.drawImage(overlay, 0, 0, base.width, base.height);
  ctx.restore();
  return base;
}

export interface StoneOptions {
  size?: number;
  count?: number;
  minRadius?: number;
  maxRadius?: number;
  /** Colour of the fines packed between the stones. */
  base?: string;
  low?: string;
  high?: string;
  seed?: number;
  /** Draw a brighter facet on each stone's upper-left. Wanted on a colour map, not on a height map. */
  facets?: boolean;
}

/**
 * Crushed rock: irregular angular polygons rather than discs.
 *
 * Track ballast is quarried and screened, so every stone is a shattered polyhedron with flat faces
 * and sharp arrises. Drawn as circles it reads as gravel-effect wallpaper; drawn as polygons with a
 * lit face it reads as ballast — which, after the sky, is the most-seen surface in the film.
 */
export function createStoneCanvas({
  size = 256,
  count = 420,
  minRadius = 3,
  maxRadius = 11,
  base = "#5d564a",
  low = "#6b6357",
  high = "#cfc7b4",
  seed = 7,
  facets = true,
}: StoneOptions = {}): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(seed);
  const [lr, lg, lb] = parseHex(low);
  const [hr, hg, hb] = parseHex(high);

  const polygon = (cx: number, cy: number, r: number, jitter: number[], rot: number) => {
    ctx.beginPath();
    for (let s = 0; s < jitter.length; s++) {
      const a = rot + (s / jitter.length) * Math.PI * 2;
      const rr = r * jitter[s];
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };

  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = minRadius + rand() * (maxRadius - minRadius);
    const sides = 5 + Math.floor(rand() * 3);
    const rot = rand() * Math.PI * 2;
    const jitter = Array.from({ length: sides }, () => 0.62 + rand() * 0.55);
    const t = rand();
    const cr = lr + (hr - lr) * t;
    const cg = lg + (hg - lg) * t;
    const cb = lb + (hb - lb) * t;
    const body = `rgb(${cr | 0},${cg | 0},${cb | 0})`;
    const litFace = `rgb(${Math.min(255, cr + 34) | 0},${Math.min(255, cg + 32) | 0},${Math.min(255, cb + 28) | 0})`;

    // Redraw any stone overhanging an edge on the opposite side, so the pattern stays seamless.
    const xs = x < maxRadius ? [x, x + size] : x > size - maxRadius ? [x, x - size] : [x];
    const ys = y < maxRadius ? [y, y + size] : y > size - maxRadius ? [y, y - size] : [y];
    for (const px of xs) {
      for (const py of ys) {
        ctx.fillStyle = body;
        polygon(px, py, r, jitter, rot);
        if (facets) {
          ctx.fillStyle = litFace;
          polygon(px - r * 0.18, py - r * 0.2, r * 0.56, jitter, rot);
        }
      }
    }
  }
  return canvas;
}

/**
 * Cheap ambient occlusion baked from a height canvas: a pixel sitting below its neighbourhood
 * average is in a pit, and pits catch less light.
 *
 * Paired with the matching normal map this is what stops relief flattening out under the broad
 * ambient and hemisphere fill — a normal map alone cannot darken a crevice, it can only turn it
 * away from the key light, so unlit sides of the relief stay as bright as the peaks.
 */
export function createAoCanvas(source: HTMLCanvasElement, strength = 1.6, radius = 5): HTMLCanvasElement {
  const size = source.width;
  const src = source.getContext("2d")!.getImageData(0, 0, size, size).data;
  const height = new Float32Array(size * size);
  for (let i = 0; i < height.length; i++) {
    height[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
  }

  // Separable wrapping box blur — the "neighbourhood average" the height is compared against.
  const blurAxis = (input: Float32Array, horizontal: boolean): Float32Array => {
    const out = new Float32Array(input.length);
    const span = radius * 2 + 1;
    const at = (a: number, b: number) => (horizontal ? a * size + b : b * size + a);
    for (let a = 0; a < size; a++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += input[at(a, ((k % size) + size) % size)];
      for (let b = 0; b < size; b++) {
        out[at(a, b)] = sum / span;
        sum += input[at(a, (b + radius + 1) % size)] - input[at(a, (b - radius + size) % size)];
      }
    }
    return out;
  };
  const blurred = blurAxis(blurAxis(height, true), false);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < height.length; i++) {
    const ao = Math.min(Math.max(1 - strength * Math.max(blurred[i] - height[i], 0), 0.25), 1) * 255;
    image.data[i * 4] = ao;
    image.data[i * 4 + 1] = ao;
    image.data[i * 4 + 2] = ao;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export interface WindowGridOptions {
  size?: number;
  rows?: number;
  cols?: number;
  wall?: string;
  glass?: string;
  /** Fraction of windows with a light on behind them. */
  litRatio?: number;
  lit?: string;
  seed?: number;
  /** Emissive variant: everything unlit is black, so it adds glow without lifting the wall tone. */
  emissive?: boolean;
}

/**
 * A facade: window openings in courses, a scatter of them lit.
 *
 * The distant buildings were flat coloured boxes, which is what made the town and city backdrops
 * read as blocks rather than a skyline. Windows are the only cue that gives a box a scale, and lit
 * ones are what say the place is inhabited — one texture, no extra geometry, no extra draw calls.
 */
export function createWindowGridCanvas({
  size = 256,
  rows = 9,
  cols = 6,
  wall = "#9aa0a8",
  glass = "#2b3540",
  litRatio = 0.22,
  lit = "#ffe0a8",
  seed = 3,
  emissive = false,
}: WindowGridOptions = {}): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = emissive ? "#000000" : wall;
  ctx.fillRect(0, 0, size, size);

  const rand = mulberry32(seed);
  const cellW = size / cols;
  const cellH = size / rows;
  const padX = cellW * 0.26;
  const padY = cellH * 0.3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isLit = rand() < litRatio;
      if (emissive && !isLit) continue;
      ctx.fillStyle = isLit ? lit : glass;
      ctx.fillRect(c * cellW + padX, r * cellH + padY, cellW - padX * 2, cellH - padY * 2);
    }
  }
  return canvas;
}

export interface PanelOptions {
  size?: number;
  /** Horizontal beading courses across the panel. */
  bands?: number;
  /** Vertical panel joints. */
  seams?: number;
  /** Rivets per seam. 0 leaves the joints plain welded. */
  rivets?: number;
  base?: string;
  recess?: string;
  raised?: string;
}

/**
 * Coachwork: beading courses, vertical panel joints and rivet rows.
 *
 * A railway carriage is a riveted or welded steel box, and every one of those joints catches the
 * light as a line. The film renders its carriages as single flat-coloured boxes, which is why a
 * train two metres from the camera has less surface detail than the ballast under it — a painted
 * panel with nothing on it reads as cardboard at any resolution. This is a height field, so one
 * pattern drives the relief, the occlusion in the seams and the wear along the beading alike.
 */
export function createPanelCanvas({
  size = 256,
  bands = 4,
  seams = 6,
  rivets = 14,
  base = "#808080",
  recess = "#3a3a3a",
  raised = "#d8d8d8",
}: PanelOptions = {}): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Vertical joints first, so the horizontal beading runs over them the way a waist rail does.
  const seamStep = size / seams;
  for (let i = 0; i < seams; i++) {
    const x = i * seamStep;
    ctx.fillStyle = recess;
    ctx.fillRect(x - 1, 0, 2, size);
    ctx.fillStyle = raised;
    ctx.fillRect(x + 1, 0, 1, size);
  }

  const bandStep = size / bands;
  for (let i = 0; i < bands; i++) {
    const y = i * bandStep;
    ctx.fillStyle = recess;
    ctx.fillRect(0, y - 1.5, size, 3);
    ctx.fillStyle = raised;
    ctx.fillRect(0, y + 1.5, size, 2);
  }

  if (rivets > 0) {
    const rivetStep = size / rivets;
    ctx.fillStyle = raised;
    for (let i = 0; i < seams; i++) {
      const x = i * seamStep - 3.5;
      for (let r = 0; r < rivets; r++) {
        ctx.beginPath();
        ctx.arc(x, r * rivetStep + rivetStep / 2, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  return canvas;
}
