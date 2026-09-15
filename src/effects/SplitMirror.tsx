import type { RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * Copies every finished frame of the main WebGL canvas into a second 2D canvas, so split-screen mode
 * shows the exact same picture on both halves without rendering the scene (or PostFX) twice.
 * Priority 2 runs after the EffectComposer's render (priority 1) in the same rAF task, while the
 * drawing buffer is still intact — no `preserveDrawingBuffer` needed.
 */
export function SplitMirror({ target }: { target: RefObject<HTMLCanvasElement | null> }) {
  const gl = useThree((s) => s.gl);

  useFrame(() => {
    const out = target.current;
    if (!out) return;
    const src = gl.domElement;
    if (out.width !== src.width || out.height !== src.height) {
      out.width = src.width;
      out.height = src.height;
    }
    out.getContext("2d")?.drawImage(src, 0, 0);
  }, 2);

  return null;
}
