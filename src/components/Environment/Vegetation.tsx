import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const TREE_COUNT = 46;
const FIELD_Z_RANGE: [number, number] = [-68, 68];

interface TreeLayout {
  x: number;
  z: number;
  scale: number;
  rotation: number;
}

/** Scattered low-poly trees on both sides of the track for background depth and a less bare horizon. */
export function Vegetation() {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const foliageRef = useRef<THREE.InstancedMesh>(null);

  const layouts = useMemo<TreeLayout[]>(() => {
    const items: TreeLayout[] = [];
    for (let i = 0; i < TREE_COUNT; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (9 + Math.random() * 16);
      const z = FIELD_Z_RANGE[0] + Math.random() * (FIELD_Z_RANGE[1] - FIELD_Z_RANGE[0]);
      // Keep clear of the platform/station footprint near the origin on the -X side.
      if (x < 0 && x > -8.5 && z > -8 && z < 12) continue;
      items.push({ x, z, scale: 0.75 + Math.random() * 0.7, rotation: Math.random() * Math.PI * 2 });
    }
    return items;
  }, []);

  useEffect(() => {
    const trunk = trunkRef.current;
    const foliage = foliageRef.current;
    if (!trunk || !foliage) return;
    const dummy = new THREE.Object3D();
    layouts.forEach((t, i) => {
      dummy.position.set(t.x, 0.9 * t.scale, t.z);
      dummy.rotation.set(0, t.rotation, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      trunk.setMatrixAt(i, dummy.matrix);

      dummy.position.set(t.x, 2.1 * t.scale, t.z);
      dummy.updateMatrix();
      foliage.setMatrixAt(i, dummy.matrix);
    });
    trunk.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
  }, [layouts]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, layouts.length]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 1.8, 6]} />
        <meshStandardMaterial color="#4a3624" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={foliageRef} args={[undefined, undefined, layouts.length]} castShadow>
        <coneGeometry args={[1.1, 2.6, 8]} />
        <meshStandardMaterial color="#3d5a34" roughness={0.85} />
      </instancedMesh>
    </group>
  );
}
