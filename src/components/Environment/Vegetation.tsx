import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { broadleafGeometry, coniferGeometry } from "./naturalGeometry";

const TREE_COUNT = 46;
const FIELD_Z_RANGE: [number, number] = [-68, 68];

interface TreeLayout {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  /** 0..1 seed for this tree's foliage colour. */
  tint: number;
  /** Spruce or broadleaf. Two species is what keeps a static copse from reading as a stencil. */
  conifer: boolean;
}

/** Scattered trees on both sides of the track for background depth and a less bare horizon. */
export function Vegetation() {
  const coniferRef = useRef<THREE.InstancedMesh>(null);
  const broadleafRef = useRef<THREE.InstancedMesh>(null);

  const layouts = useMemo<TreeLayout[]>(() => {
    const items: TreeLayout[] = [];
    for (let i = 0; i < TREE_COUNT; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (9 + Math.random() * 16);
      const z = FIELD_Z_RANGE[0] + Math.random() * (FIELD_Z_RANGE[1] - FIELD_Z_RANGE[0]);
      // Keep clear of the platform/station footprint near the origin on the -X side.
      if (x < 0 && x > -8.5 && z > -8 && z < 12) continue;
      items.push({ x, z, scale: 0.9 + Math.random() * 1.0, rotation: Math.random() * Math.PI * 2, tint: Math.random(), conifer: Math.random() < 0.55 });
    }
    return items;
  }, []);

  const conifers = useMemo(() => layouts.filter((t) => t.conifer), [layouts]);
  const broadleaves = useMemo(() => layouts.filter((t) => !t.conifer), [layouts]);

  useEffect(() => {
    const dummy = new THREE.Object3D();
    const shade = new THREE.Color();
    const place = (mesh: THREE.InstancedMesh | null, trees: TreeLayout[]) => {
      if (!mesh) return;
      trees.forEach((t, i) => {
        // Both geometries are authored with their base at y = 0, so a tree only has to be dropped
        // on the ground rather than having its trunk and its canopy positioned separately by eye.
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.rotation, 0);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        // No two trees are the same green — see `ScrollField` for the same trick on the moving
        // fields. Three multiplies this into the geometry's own vertex colours, so the trunk stays
        // a trunk while the canopy shifts.
        const v = 0.85 + t.tint * 0.35;
        shade.setRGB(v * 0.97, v, v * 0.88);
        mesh.setColorAt(i, shade);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    place(coniferRef.current, conifers);
    place(broadleafRef.current, broadleaves);
  }, [conifers, broadleaves]);

  return (
    <group>
      <instancedMesh ref={coniferRef} args={[undefined, undefined, conifers.length]} castShadow receiveShadow>
        <primitive object={coniferGeometry()} attach="geometry" />
        <meshStandardMaterial vertexColors roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={broadleafRef} args={[undefined, undefined, broadleaves.length]} castShadow receiveShadow>
        <primitive object={broadleafGeometry()} attach="geometry" />
        <meshStandardMaterial vertexColors roughness={0.88} />
      </instancedMesh>
    </group>
  );
}
