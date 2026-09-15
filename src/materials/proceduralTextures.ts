import * as THREE from "three";

interface SpeckleOptions {
  size?: number;
  baseColor?: string;
  variationColor?: string;
  cellCount?: number;
  minRadius?: number;
  maxRadius?: number;
  opacity?: number;
  /** Treat as a color texture (sRGB) vs. a data texture (roughness/AO, linear). */
  isColor?: boolean;
}

/** Small tileable canvas texture: a base tone speckled with soft blotches. Breaks up flat CG color fills. */
export function createSpeckleTexture({
  size = 256,
  baseColor = "#808080",
  variationColor = "#404040",
  cellCount = 900,
  minRadius = 1,
  maxRadius = 6,
  opacity = 0.5,
  isColor = true,
}: SpeckleOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = variationColor;
  ctx.globalAlpha = opacity;
  for (let i = 0; i < cellCount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = minRadius + Math.random() * (maxRadius - minRadius);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface StreakOptions {
  size?: number;
  baseColor?: string;
  streakColor?: string;
  streakCount?: number;
  opacity?: number;
  vertical?: boolean;
  isColor?: boolean;
}

/** Tileable canvas texture with fine directional streaks — wood grain, brushed metal. */
export function createStreakTexture({
  size = 256,
  baseColor = "#6b4423",
  streakColor = "#4a2f18",
  streakCount = 40,
  opacity = 0.35,
  vertical = false,
  isColor = true,
}: StreakOptions = {}): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = streakColor;
  ctx.globalAlpha = opacity;
  for (let i = 0; i < streakCount; i++) {
    const offset = (i / streakCount) * size + (Math.random() - 0.5) * (size / streakCount);
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + (Math.random() - 0.5) * 6, size);
    } else {
      ctx.moveTo(0, offset);
      ctx.lineTo(size, offset + (Math.random() - 0.5) * 6);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const cache = new Map<string, THREE.CanvasTexture>();

/** Memoized accessor so repeated calls (e.g. across re-renders) share one GPU texture. */
export function getSharedTexture(key: string, factory: () => THREE.CanvasTexture): THREE.CanvasTexture {
  const existing = cache.get(key);
  if (existing) return existing;
  const texture = factory();
  cache.set(key, texture);
  return texture;
}
