import type * as THREE from "three";

/** Recursively force every material under `object` to a given opacity/transparency. */
export function applyOpacity(object: THREE.Object3D | null | undefined, opacity: number) {
  if (!object) return;
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    const materials = Array.isArray(material) ? material : [material];
    for (const mat of materials) {
      const m = mat as THREE.Material & { opacity: number; transparent: boolean };
      m.transparent = true;
      m.opacity = opacity;
    }
  });
  object.visible = opacity > 0.01;
}
