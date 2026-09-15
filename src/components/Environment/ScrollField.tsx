import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Instance {
  x: number;
  zSeed: number;
  y: number;
  scale: number;
  rot: number;
}

interface ScrollFieldProps {
  count: number;
  /** Distance (world units) after which the instance pattern repeats. */
  cycleLength: number;
  /** Lateral placement range from track centerline; negative = left side. */
  xRange: [number, number];
  /** Distance traveled so far (world units), read every frame — the scene drives this, not React state. */
  distanceRef: React.MutableRefObject<number>;
  /** Depth-layering multiplier on scroll speed (<1 = appears farther away / moves slower). */
  parallax?: number;
  /** Base height multiplied by each instance's scale, so geometry authored with its base at y=0 sits on the ground. */
  yBase?: number;
  scaleRange?: [number, number];
  castShadow?: boolean;
  children: React.ReactNode;
}

/**
 * An "infinite conveyor" of instanced props: each instance's Z position is recomputed every frame
 * from a fixed seed minus the traveled distance (mod the cycle length), so the field appears to
 * scroll past a stationary camera forever without moving any real geometry through a huge world.
 */
export function ScrollField({
  count,
  cycleLength,
  xRange,
  distanceRef,
  parallax = 1,
  yBase = 0,
  scaleRange = [0.8, 1.3],
  castShadow = true,
  children,
}: ScrollFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const half = cycleLength / 2;

  const instances = useMemo<Instance[]>(() => {
    const arr: Instance[] = [];
    for (let i = 0; i < count; i++) {
      const scale = THREE.MathUtils.lerp(scaleRange[0], scaleRange[1], Math.random());
      arr.push({
        x: THREE.MathUtils.lerp(xRange[0], xRange[1], Math.random()),
        zSeed: Math.random() * cycleLength,
        y: yBase * scale,
        scale,
        rot: Math.random() * Math.PI * 2,
      });
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const traveled = distanceRef.current * parallax;
    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      let z = (inst.zSeed - traveled) % cycleLength;
      if (z < -half) z += cycleLength;
      if (z > half) z -= cycleLength;
      dummy.position.set(inst.x, inst.y, z);
      dummy.rotation.set(0, inst.rot, 0);
      dummy.scale.setScalar(inst.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow={castShadow} receiveShadow>
      {children}
    </instancedMesh>
  );
}
