import * as THREE from "three";
import { createNormalTexture, createSpeckleCanvas, createSpeckleTexture, createStreakCanvas, createStreakTexture, getSharedTexture, tileable } from "./proceduralTextures";
import { createAoCanvas, createNoiseCanvas, createPanelCanvas, createStoneCanvas, createWindowGridCanvas, overlayCanvas } from "./noise";

/**
 * Every surface's colour, roughness, relief and occlusion are generated from *one* height pattern
 * per material, cached here.
 *
 * That shared source is the point. A normal map built from different noise than the colour map
 * floats over it as unrelated fuzz; built from the same pattern, the bumps land exactly where the
 * stones and the grain are, and the occlusion darkens exactly the crevices between them. It is also
 * what lets a material be retuned in one place instead of three.
 */
const canvasCache = new Map<string, HTMLCanvasElement>();

function sharedCanvas(key: string, factory: () => HTMLCanvasElement): HTMLCanvasElement {
  const existing = canvasCache.get(key);
  if (existing) return existing;
  const canvas = factory();
  canvasCache.set(key, canvas);
  return canvas;
}

// ---------------------------------------------------------------------------------------------
// Height sources. Grayscale, never rendered directly — read by the normal and AO bakers below.
// ---------------------------------------------------------------------------------------------

/** Dirt and gravel underfoot: broad, shallow undulation with a grain of loose material on top. */
const groundHeight = () =>
  sharedCanvas("ground-height", () =>
    overlayCanvas(
      createNoiseCanvas({ cells: 14, octaves: 5, contrast: 1.35, seed: 11, low: "#3c3c3c", high: "#d2d2d2" }),
      createSpeckleCanvas({ baseColor: "#808080", variationColor: "#3a3a3a", cellCount: 900, minRadius: 1, maxRadius: 4, opacity: 0.5 }),
      0.45,
    ),
  );

/** Ballast without the lit facets, so the baker reads stone shapes as height rather than as light. */
const ballastHeight = () =>
  sharedCanvas("ballast-height", () =>
    createStoneCanvas({ count: 520, minRadius: 3, maxRadius: 10, base: "#3a3a3a", low: "#5a5a5a", high: "#f0f0f0", facets: false, seed: 21 }),
  );

/** Poured concrete: float marks and aggregate, with hairline crazing from the ridged octaves. */
const concreteHeight = () =>
  sharedCanvas("concrete-height", () =>
    overlayCanvas(
      createNoiseCanvas({ cells: 9, octaves: 5, contrast: 1.1, seed: 5, low: "#6a6a6a", high: "#cccccc" }),
      createNoiseCanvas({ cells: 22, octaves: 3, ridged: true, contrast: 1.7, seed: 33, low: "#2a2a2a", high: "#a0a0a0" }),
      0.3,
    ),
  );

/** Sawn and weathered timber: long grain, with knots where the low-frequency octaves pinch. */
const woodHeight = () =>
  sharedCanvas("wood-height", () =>
    overlayCanvas(
      createNoiseCanvas({ cells: 3, octaves: 5, stretchX: 0.16, stretchY: 5, contrast: 1.5, seed: 17, low: "#3a3a3a", high: "#d8d8d8" }),
      createStreakCanvas({ baseColor: "#808080", streakColor: "#2e2e2e", streakCount: 26, opacity: 0.6, vertical: false }),
      0.4,
    ),
  );

/** Rail steel: rolling-mill scale and rust pitting, shallow — the running surface stays polished. */
const railHeight = () =>
  sharedCanvas("rail-height", () =>
    overlayCanvas(
      createNoiseCanvas({ cells: 5, octaves: 4, stretchX: 0.3, stretchY: 3, contrast: 1.2, seed: 41, low: "#5a5a5a", high: "#bcbcbc" }),
      createSpeckleCanvas({ baseColor: "#808080", variationColor: "#4a4a4a", cellCount: 300, minRadius: 1, maxRadius: 4, opacity: 0.45 }),
      0.5,
    ),
  );

/** Broken coal: sharp conchoidal faces, which is what makes a heap read as mineral rather than soil. */
const coalHeight = () =>
  sharedCanvas("coal-height", () =>
    createStoneCanvas({ count: 620, minRadius: 2, maxRadius: 8, base: "#303030", low: "#3c3c3c", high: "#e2e2e2", facets: false, seed: 61 }),
  );

/** Woven upholstery, close enough to the eye that the weave has to be felt rather than implied. */
const fabricHeight = () =>
  sharedCanvas("fabric-height", () =>
    createSpeckleCanvas({ baseColor: "#808080", variationColor: "#4a4a4a", cellCount: 2200, minRadius: 0.6, maxRadius: 2, opacity: 0.6 }),
  );

/** Rust and firebox soot on the steam locomotive's ironwork: blotchy, with a hard-edged scale grain. */
const ironHeight = () =>
  sharedCanvas("iron-height", () =>
    overlayCanvas(
      createNoiseCanvas({ cells: 4, octaves: 5, contrast: 1.6, seed: 29, low: "#303030", high: "#c4c4c4" }),
      createNoiseCanvas({ cells: 16, octaves: 3, ridged: true, contrast: 1.4, seed: 71, low: "#404040", high: "#b0b0b0" }),
      0.35,
    ),
  );

// ---------------------------------------------------------------------------------------------
// Colour maps.
// ---------------------------------------------------------------------------------------------

/** Ground: dirt/gravel colour variation. Kept near-white on average so it only adds texture on top
 * of the material's own tinted colour, instead of darkening it. */
export function groundColorTexture(): THREE.CanvasTexture {
  return getSharedTexture("ground-color", () =>
    tileable(
      overlayCanvas(
        createNoiseCanvas({ cells: 14, octaves: 5, contrast: 1.2, seed: 11, low: "#bdb193", high: "#efe8d2" }),
        createSpeckleCanvas({ baseColor: "#808080", variationColor: "#5b5240", cellCount: 900, minRadius: 1, maxRadius: 4, opacity: 0.4 }),
        0.35,
      ),
      true,
    ),
  );
}

export function groundRoughnessTexture(): THREE.CanvasTexture {
  return getSharedTexture("ground-roughness", () =>
    // Inverted against the height: the raised, wind-scoured high ground is polished smoother than
    // the damp hollows, which is the variation that keeps a large flat plane from reading as vinyl.
    tileable(createNoiseCanvas({ cells: 10, octaves: 5, contrast: 1.5, seed: 11, low: "#f0f0f0", high: "#7a7a7a" }), false),
  );
}

/** Ballast gravel: crushed, angular, screened — drawn as polygons rather than discs. */
export function ballastColorTexture(): THREE.CanvasTexture {
  return getSharedTexture("ballast-color", () =>
    tileable(
      createStoneCanvas({ count: 520, minRadius: 3, maxRadius: 10, base: "#6e6551", low: "#8d8571", high: "#e2dac4", seed: 21 }),
      true,
    ),
  );
}

export function ballastRoughnessTexture(): THREE.CanvasTexture {
  return getSharedTexture("ballast-roughness", () =>
    tileable(createNoiseCanvas({ cells: 6, octaves: 4, contrast: 1.3, seed: 23, low: "#d8d8d8", high: "#8a8a8a" }), false),
  );
}

/** Weathered steel rail: rust and mill scale streaked along the direction of rolling. */
export function railColorTexture(): THREE.CanvasTexture {
  return getSharedTexture("rail-color", () =>
    tileable(
      overlayCanvas(
        createNoiseCanvas({ cells: 5, octaves: 4, stretchX: 0.3, stretchY: 3, contrast: 1.3, seed: 41, low: "#8e7355", high: "#ccd2d8" }),
        createSpeckleCanvas({ baseColor: "#808080", variationColor: "#6b4f34", cellCount: 300, minRadius: 1, maxRadius: 4, opacity: 0.3 }),
        0.4,
      ),
      true,
    ),
  );
}

/** Aged wood grain for steam-era platform/station timber. */
export function woodGrainTexture(): THREE.CanvasTexture {
  return getSharedTexture("wood-grain", () =>
    tileable(
      overlayCanvas(
        createNoiseCanvas({ cells: 3, octaves: 5, stretchX: 0.16, stretchY: 5, contrast: 1.35, seed: 17, low: "#432c18", high: "#8a6440" }),
        createStreakCanvas({ baseColor: "#808080", streakColor: "#3a2616", streakCount: 26, opacity: 0.5, vertical: false }),
        0.45,
      ),
      true,
    ),
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
    tileable(
      overlayCanvas(
        createNoiseCanvas({ cells: 9, octaves: 5, contrast: 1.15, seed: 5, low: "#7f7f78", high: "#a9a9a0" }),
        createNoiseCanvas({ cells: 22, octaves: 3, ridged: true, contrast: 1.8, seed: 33, low: "#5e5e58", high: "#b4b4ab" }),
        0.28,
      ),
      true,
    ),
  );
}

/** Rust/grime speckle for the steam locomotive's boiler and ironwork. */
export function ironGrimeTexture(): THREE.CanvasTexture {
  return getSharedTexture("iron-grime", () =>
    tileable(createNoiseCanvas({ cells: 4, octaves: 5, contrast: 1.5, seed: 29, low: "#1f1f1f", high: "#6a4a30" }), false),
  );
}

/** Woven-fabric roughness variation for seat upholstery. A roughness-only map (no colour data), so
 * it pairs with any theme's seat `color` — used the same way `ironGrimeTexture` layers onto any base tone. */
export function fabricRoughnessTexture(): THREE.CanvasTexture {
  return getSharedTexture("fabric-roughness", () =>
    createSpeckleTexture({ baseColor: "#808080", variationColor: "#3a3a3a", cellCount: 2200, minRadius: 0.6, maxRadius: 2, opacity: 0.35, isColor: false }),
  );
}

/** Fine non-slip floor texture (rubber/vinyl composite) for the cabin floor. */
export function floorRoughnessTexture(): THREE.CanvasTexture {
  return getSharedTexture("floor-roughness", () =>
    createSpeckleTexture({ baseColor: "#7a7a7a", variationColor: "#2a2a2a", cellCount: 1200, minRadius: 1, maxRadius: 3, opacity: 0.4, isColor: false }),
  );
}

// ---------------------------------------------------------------------------------------------
// Facades. The distant buildings were flat coloured boxes; windows are the only cue that gives a
// box a scale, and a scatter of lit ones is what says the place is inhabited.
// ---------------------------------------------------------------------------------------------

/** Daytime facade: dark glass in the openings, plain render between. */
export function facadeTexture(tall: boolean): THREE.CanvasTexture {
  return getSharedTexture(tall ? "facade-tall" : "facade-low", () =>
    tileable(
      createWindowGridCanvas(
        tall
          ? { rows: 12, cols: 7, wall: "#9aa2ad", glass: "#38424f", litRatio: 0.18, seed: 3 }
          : { rows: 4, cols: 4, wall: "#b6a88b", glass: "#4a4034", litRatio: 0.26, seed: 9 },
      ),
      true,
    ),
  );
}

/** The lit windows alone, as an emissive map — so the same facade warms up as the light goes. */
export function facadeEmissiveTexture(tall: boolean): THREE.CanvasTexture {
  return getSharedTexture(tall ? "facade-tall-lit" : "facade-low-lit", () =>
    tileable(
      createWindowGridCanvas(
        tall
          ? { rows: 12, cols: 7, litRatio: 0.18, lit: "#ffe6b4", seed: 3, emissive: true }
          : { rows: 4, cols: 4, litRatio: 0.26, lit: "#ffd79a", seed: 9, emissive: true },
      ),
      true,
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// Normal maps, baked from the height sources above. The `strength` figures are the relief of the
// real material: loose ballast is deep, a rail head is almost flat, sawn timber is between.
// ---------------------------------------------------------------------------------------------

export function groundNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("ground-normal", () => createNormalTexture(groundHeight(), 2.4));
}

/** Ballast: the deepest relief in the film — thousands of individually lit stones. */
export function ballastNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("ballast-normal", () => createNormalTexture(ballastHeight(), 3.4));
}

export function railNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("rail-normal", () => createNormalTexture(railHeight(), 1.2));
}

export function woodNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("wood-normal", () => createNormalTexture(woodHeight(), 2.2));
}

export function concreteNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("concrete-normal", () => createNormalTexture(concreteHeight(), 1.4));
}

export function coalNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("coal-normal", () => createNormalTexture(coalHeight(), 3));
}

export function fabricNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("fabric-normal", () => createNormalTexture(fabricHeight(), 1.6));
}

export function ironNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("iron-normal", () => createNormalTexture(ironHeight(), 1.8));
}

// ---------------------------------------------------------------------------------------------
// Ambient-occlusion maps, baked from the same height sources.
//
// A normal map cannot darken a crevice — it can only turn it away from the key light, so under the
// broad ambient and hemisphere fill the gaps between ballast stones stay as bright as their tops and
// the relief washes out. These put the contact shadow back in, at the scale SSAO cannot reach.
// ---------------------------------------------------------------------------------------------

export function groundAoTexture(): THREE.CanvasTexture {
  return getSharedTexture("ground-ao", () => tileable(createAoCanvas(groundHeight(), 1.5, 6), false));
}

export function ballastAoTexture(): THREE.CanvasTexture {
  return getSharedTexture("ballast-ao", () => tileable(createAoCanvas(ballastHeight(), 2.2, 4), false));
}

export function concreteAoTexture(): THREE.CanvasTexture {
  return getSharedTexture("concrete-ao", () => tileable(createAoCanvas(concreteHeight(), 1.2, 5), false));
}

export function coalAoTexture(): THREE.CanvasTexture {
  return getSharedTexture("coal-ao", () => tileable(createAoCanvas(coalHeight(), 2.4, 4), false));
}

export function woodAoTexture(): THREE.CanvasTexture {
  return getSharedTexture("wood-ao", () => tileable(createAoCanvas(woodHeight(), 1.3, 4), false));
}

// ---------------------------------------------------------------------------------------------
// Ploughed ground. A crop field is never one flat colour seen from a train window: the drill rows
// run in one direction and catch the low sun along their length, which is most of what makes a
// patch read as cultivated ground rather than a green mat laid over the landscape.
// ---------------------------------------------------------------------------------------------

const furrowHeight = () =>
  sharedCanvas("crop-furrow-height", () =>
    createNoiseCanvas({ cells: 2, octaves: 4, stretchX: 0.09, stretchY: 9, contrast: 1.6, seed: 77, low: "#2e2e2e", high: "#e2e2e2" }),
  );

export function cropFurrowTexture(): THREE.CanvasTexture {
  return getSharedTexture("crop-furrow", () => tileable(furrowHeight(), false));
}

export function cropFurrowNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("crop-furrow-normal", () => createNormalTexture(furrowHeight(), 2));
}

// ---------------------------------------------------------------------------------------------
// Coachwork. The carriages are the closest thing to the camera for much of the film and were the
// flattest surfaces in it: single-colour boxes with less relief than the ballast underneath them.
// ---------------------------------------------------------------------------------------------

const panelHeight = () =>
  sharedCanvas("panel-height", () =>
    overlayCanvas(
      createPanelCanvas({ bands: 4, seams: 6, rivets: 14 }),
      createNoiseCanvas({ cells: 8, octaves: 4, contrast: 1.1, seed: 91, low: "#6e6e6e", high: "#949494" }),
      0.3,
    ),
  );

export function panelNormalTexture(): THREE.CanvasTexture {
  return getSharedTexture("panel-normal", () => createNormalTexture(panelHeight(), 1.5));
}

export function panelAoTexture(): THREE.CanvasTexture {
  return getSharedTexture("panel-ao", () => tileable(createAoCanvas(panelHeight(), 1.1, 3), false));
}

/** Rain runs and hand-polish: paint is never uniformly glossy over a whole carriage side. */
export function panelRoughnessTexture(): THREE.CanvasTexture {
  return getSharedTexture("panel-roughness", () =>
    tileable(
      overlayCanvas(
        createNoiseCanvas({ cells: 3, octaves: 4, stretchX: 0.35, stretchY: 4, contrast: 1.3, seed: 93, low: "#9a9a9a", high: "#e4e4e4" }),
        createPanelCanvas({ bands: 4, seams: 6, rivets: 14, base: "#808080", recess: "#b0b0b0", raised: "#666666" }),
        0.35,
      ),
      false,
    ),
  );
}
