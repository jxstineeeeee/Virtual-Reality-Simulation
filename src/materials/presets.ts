import * as THREE from "three";
import { createNormalTexture, createSpeckleCanvas, createSpeckleTexture, createStreakCanvas, createStreakTexture, getSharedTexture } from "./proceduralTextures";

/** Ground: dirt/gravel color variation. Kept near-white on average so it only adds
 * texture on top of the material's own tinted color, instead of darkening it. */
export function groundColorTexture(): THREE.CanvasTexture {
  return getSharedTexture("ground-color", () =>
    createSpeckleTexture({ baseColor: "#e8e0c8", variationColor: "#c9bd98", cellCount: 500, minRadius: 6, maxRadius: 26, opacity: 0.3 }),
  );
}

export function groundRoughnessTexture(): THREE.CanvasTexture {
  return getSharedTexture("ground-roughness", () =>
    createSpeckleTexture({ baseColor: "#c8c8c8", variationColor: "#5a5a5a", cellCount: 700, minRadius: 3, maxRadius: 18, opacity: 0.5, isColor: false }),
  );
}

/** Ballast gravel: fine high-frequency speckle, kept bright so it textures rather than darkens. */
export function ballastColorTexture(): THREE.CanvasTexture {
  return getSharedTexture("ballast-color", () =>
    createSpeckleTexture({ baseColor: "#d9cdaf", variationColor: "#a89878", cellCount: 1600, minRadius: 1, maxRadius: 5, opacity: 0.45 }),
  );
}

/** Weathered steel rail: subtle rust speckle over a bright metallic base. */
export function railColorTexture(): THREE.CanvasTexture {
  return getSharedTexture("rail-color", () =>
    createSpeckleTexture({ baseColor: "#c7ccd1", variationColor: "#9a7a5a", cellCount: 300, minRadius: 1, maxRadius: 4, opacity: 0.2 }),
  );
}

/** Aged wood grain for steam-era platform/station timber. */
export function woodGrainTexture(): THREE.CanvasTexture {
  return getSharedTexture("wood-grain", () =>
    createStreakTexture({ baseColor: "#6b4a2c", streakColor: "#432c18", streakCount: 26, opacity: 0.4, vertical: false }),
  );
}

/** Brushed steel for modern-era structures. */
export function brushedMetalTexture(): THREE.CanvasTexture {
  return getSharedTexture("brushed-metal", () =>
    createStreakTexture({ baseColor: "#b7bcc2", streakColor: "#8d939a", streakCount: 60, opacity: 0.25, vertical: true, isColor: false }),
  );
}

/** Concrete/render texture for platform surfaces. */
export function concreteTexture(): THREE.CanvasTexture {
  return getSharedTexture("concrete", () =>
    createSpeckleTexture({ baseColor: "#9a9a92", variationColor: "#7d7d74", cellCount: 400, minRadius: 4, maxRadius: 20, opacity: 0.3 }),
  );
}

/** Rust/grime speckle for the steam locomotive's boiler and ironwork. */
export function ironGrimeTexture(): THREE.CanvasTexture {
  return getSharedTexture("iron-grime", () =>
    createSpeckleTexture({ baseColor: "#2a2a2a", variationColor: "#4a3324", cellCount: 500, minRadius: 1, maxRadius: 5, opacity: 0.4, isColor: false }),
  );
}

/** Woven-fabric roughness variation for seat upholstery. A roughness-only map (no color data), so it
 * pairs with any theme's seat `color` — used the same way `ironGrimeTexture` layers onto any base tone. */
export function fabricRoughnessTexture(): THREE.CanvasTexture {
  return getSharedTexture("fabric-roughness", () =>
    createSpeckleTexture({ baseColor: "#808080", variationColor: "#3a3a3a", cellCount: 2200, minRadius: 0.6, maxRadius: 2, opacity: 0.35, isColor: false }),
  );
}

// ---------------------------------------------------------------------------------------------
// Normal maps. Each one is generated from the *same* pattern as its colour map, so the bumps land
// exactly where the speckle or the grain is rather than floating over it as unrelated noise. The
// `strength` figures are the relief of the real material: loose ballast is deep, a rail head is
// almost flat, sawn timber is somewhere between.
// ---------------------------------------------------------------------------------------------

/** Dirt and gravel underfoot: broad, shallow undulation. */
export function groundNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("ground-normal", () =>
    createNormalTexture(
      createSpeckleCanvas({ baseColor: "#808080", variationColor: "#3a3a3a", cellCount: 500, minRadius: 6, maxRadius: 26, opacity: 0.55 }),
      2.4,
    ),
  );
}

/** Ballast: the deepest relief in the film — thousands of individually lit stones. */
export function ballastNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("ballast-normal", () =>
    createNormalTexture(
      createSpeckleCanvas({ baseColor: "#808080", variationColor: "#262626", cellCount: 1600, minRadius: 1, maxRadius: 5, opacity: 0.8 }),
      3.4,
    ),
  );
}

/** Weathered rail steel: pitting and rust scale, kept shallow so the running surface still reads polished. */
export function railNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("rail-normal", () =>
    createNormalTexture(
      createSpeckleCanvas({ baseColor: "#808080", variationColor: "#4a4a4a", cellCount: 300, minRadius: 1, maxRadius: 4, opacity: 0.45 }),
      1.2,
    ),
  );
}

/** Sawn and weathered timber: the grain raised into ridges. */
export function woodNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("wood-normal", () =>
    createNormalTexture(createStreakCanvas({ baseColor: "#808080", streakColor: "#2e2e2e", streakCount: 26, opacity: 0.7, vertical: false }), 2.2),
  );
}

/** Poured concrete: aggregate and float marks, shallow. */
export function concreteNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("concrete-normal", () =>
    createNormalTexture(
      createSpeckleCanvas({ baseColor: "#808080", variationColor: "#555555", cellCount: 400, minRadius: 4, maxRadius: 20, opacity: 0.45 }),
      1.4,
    ),
  );
}

/** Broken coal: sharp conchoidal faces, which is what makes a heap read as mineral rather than soil. */
export function coalNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("coal-normal", () =>
    createNormalTexture(
      createSpeckleCanvas({ baseColor: "#808080", variationColor: "#1e1e1e", cellCount: 900, minRadius: 2, maxRadius: 9, opacity: 0.85 }),
      3,
    ),
  );
}

/** Woven upholstery, close enough to the eye that the weave has to be felt rather than implied. */
export function fabricNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("fabric-normal", () =>
    createNormalTexture(
      createSpeckleCanvas({ baseColor: "#808080", variationColor: "#4a4a4a", cellCount: 2200, minRadius: 0.6, maxRadius: 2, opacity: 0.6 }),
      1.6,
    ),
  );
}

/** Fine non-slip floor texture (rubber/vinyl composite) for the cabin floor. */
export function floorRoughnessTexture(): THREE.CanvasTexture {
  return getSharedTexture("floor-roughness", () =>
    createSpeckleTexture({ baseColor: "#7a7a7a", variationColor: "#2a2a2a", cellCount: 1200, minRadius: 1, maxRadius: 3, opacity: 0.4, isColor: false }),
  );
}
