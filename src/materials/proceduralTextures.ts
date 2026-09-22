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

const FONT_STACK = `"Segoe UI", system-ui, "Yu Gothic UI", "Meiryo", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;

interface TextOptions {
  text: string;
  /** Second, smaller line under the first — a destination under a service name, a reading under a label. */
  subText?: string;
  width?: number;
  height?: number;
  background?: string;
  color?: string;
  subColor?: string;
  /** Fraction of the canvas height the main line is set at. */
  scale?: number;
  align?: CanvasTextAlign;
  /** Draw a hairline border, as a lit display panel has against its bezel. */
  border?: string;
  /**
   * CSS font-family stack. The default carries Japanese faces after the Latin ones, because the
   * 1964 platform boards are set in kana and kanji and a missing face renders as empty boxes.
   */
  font?: string;
}

/**
 * A canvas texture carrying actual legible text — station name boards, in-carriage passenger
 * information, gate indicators. The scene is otherwise entirely geometry, and signage is the one
 * thing geometry cannot fake: a sign with no words on it reads as a blank rectangle.
 */
export function createTextTexture({
  text,
  subText,
  width = 512,
  height = 128,
  background = "#0b1016",
  color = "#eaf4ff",
  subColor = "#8fb6cc",
  scale = 0.46,
  align = "center",
  border,
  font = FONT_STACK,
}: TextOptions): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, width - 3, height - 3);
  }

  const x = align === "left" ? width * 0.05 : align === "right" ? width * 0.95 : width / 2;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  const mainSize = height * scale;
  ctx.font = `600 ${mainSize}px ${font}`;
  ctx.fillStyle = color;
  ctx.fillText(text, x, subText ? height * 0.36 : height / 2, width * 0.92);

  if (subText) {
    ctx.font = `400 ${height * scale * 0.62}px ${font}`;
    ctx.fillStyle = subColor;
    ctx.fillText(subText, x, height * 0.72, width * 0.92);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
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
