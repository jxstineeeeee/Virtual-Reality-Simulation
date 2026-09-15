import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FENCE_X = 6.2;
const FENCE_SPACING = 2.4;
const FENCE_Z_RANGE: [number, number] = [-40, 40];
const postCount = Math.floor((FENCE_Z_RANGE[1] - FENCE_Z_RANGE[0]) / FENCE_SPACING);

const SIGNAL_RED = new THREE.Color("#ff3b30");
const SIGNAL_GREEN = new THREE.Color("#3ddc6a");

interface TracksidePropsProps {
  progressRef: React.MutableRefObject<number>;
}

/** A simple wooden/steel trackside fence plus a signal post whose light logic reads as period-appropriate. */
export function TracksideProps({ progressRef }: TracksidePropsProps) {
  const postMeshRef = useRef<THREE.InstancedMesh>(null);
  const railMeshRef = useRef<THREE.InstancedMesh>(null);
  const signalMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const blinkRef = useRef(0);

  useEffect(() => {
    const posts = postMeshRef.current;
    const rails = railMeshRef.current;
    if (!posts || !rails) return;
    const dummy = new THREE.Object3D();
    // Small per-post jitter — real fencing along a rail line is never perfectly regular, and a
    // machine-precise repeat is one of the biggest tells of a procedural scene.
    for (let i = 0; i < postCount; i++) {
      const z = FENCE_Z_RANGE[0] + i * FENCE_SPACING;
      const leanX = (Math.sin(i * 12.9) * 0.5 + 0.5) * 0.05;
      const leanZ = (Math.sin(i * 7.3 + 1) * 0.5 + 0.5) * 0.03 - 0.015;
      dummy.position.set(FENCE_X + leanX, 0.45, z);
      dummy.rotation.set(leanZ, 0, leanX * 0.6);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);

      if (i < postCount - 1) {
        const sag = Math.sin(i * 3.1) * 0.02;
        dummy.position.set(FENCE_X, 0.75 - Math.abs(sag), z + FENCE_SPACING / 2);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        rails.setMatrixAt(i, dummy.matrix);
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    rails.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, delta) => {
    blinkRef.current += delta;
    const p = progressRef.current;
    if (signalMatRef.current) {
      const isGo = Math.floor(blinkRef.current / 2) % 2 === 0;
      const color = isGo ? SIGNAL_GREEN : SIGNAL_RED;
      signalMatRef.current.color.copy(color);
      signalMatRef.current.emissive.copy(color);
      signalMatRef.current.emissiveIntensity = THREE.MathUtils.lerp(1.0, 1.8, p);
    }
  });

  return (
    <group>
      <instancedMesh ref={postMeshRef} args={[undefined, undefined, postCount]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.9, 6]} />
        <meshStandardMaterial color="#4a3a28" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={railMeshRef} args={[undefined, undefined, Math.max(postCount - 1, 1)]} castShadow>
        <cylinderGeometry args={[0.025, 0.025, FENCE_SPACING, 6]} />
        <meshStandardMaterial color="#4a3a28" roughness={0.85} />
      </instancedMesh>

      {/* Trackside signal */}
      <group position={[4.4, 0, -14]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.05, 0.06, 3, 8]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.55} />
        </mesh>
        <mesh position={[0, 1.55, 0]}>
          <boxGeometry args={[0.28, 0.4, 0.16]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.55, 0.09]}>
          <circleGeometry args={[0.08, 16]} />
          <meshStandardMaterial ref={signalMatRef} color={SIGNAL_GREEN} emissive={SIGNAL_GREEN} emissiveIntensity={1} />
        </mesh>
      </group>
    </group>
  );
}
