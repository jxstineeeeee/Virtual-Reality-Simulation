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
export function useDetailMap(factory: () => THREE.Texture, repeatX: number, repeatY: number, anisotropy = 8, variant: string | number = ""): THREE.Texture {
  return useMemo(() => {
    const tex = factory().clone();
    tex.repeat.set(repeatX * quality.detailScale, repeatY * quality.detailScale);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = anisotropy;
    // `aoMap` reads `uv1` by default, and none of this geometry has a second UV set. Pinning every
    // detail map to channel 0 is what lets an AO map be hung off the same primary UVs as its colour
    // and normal maps without authoring lightmap UVs for a film made entirely of primitives.
    tex.channel = 0;
    tex.needsUpdate = true;
    return tex;
    // The factory is a module-level texture accessor, stable by construction; `variant` is how a
    // parameterised one — a facade with a different window grid, say — names which texture it wants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatX, repeatY, anisotropy, variant]);
}
