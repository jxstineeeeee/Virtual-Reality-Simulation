import { useMemo } from "react";
import * as THREE from "three";
import { quality } from "../effects/renderQuality";

/**
 * Clones a shared procedural texture and tiles it across a surface.
 *
 * Every material in the film was already doing this by hand; collecting it here is what makes it
 * practical to hang a matching normal map off the same call, and to pull the tiling back on weaker
 * machines (`quality.detailScale`) without editing every material in the project. Anisotropy matters
 * more than it looks: these are ground and rail textures seen at a grazing angle for most of the
 * runtime, which is exactly the case trilinear filtering smears into mush.
 */
export function useDetailMap(factory: () => THREE.Texture, repeatX: number, repeatY: number, anisotropy = 8): THREE.Texture {
  return useMemo(() => {
    const tex = factory().clone();
    tex.repeat.set(repeatX * quality.detailScale, repeatY * quality.detailScale);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    tex.needsUpdate = true;
    return tex;
    // The factory is a module-level texture accessor, stable by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatX, repeatY, anisotropy]);
}
