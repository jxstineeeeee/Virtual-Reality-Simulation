import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { TrainMotionState } from "../components/Train/TrainCarrier";

interface ElectricSparkEffectProps {
  stateRef: React.MutableRefObject<TrainMotionState>;
  /** Local offset from the train's origin to its pantograph contact point. */
  offset?: [number, number, number];
}

/** Subtle flickering blue-white spark at the pantograph/overhead-wire contact point. */
export function ElectricSparkEffect({ stateRef, offset = [0, 2.75, 1.0] }: ElectricSparkEffectProps) {
  const lightRef = useRef<THREE.PointLight>(null);
  const sphereRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const { z, opacity } = stateRef.current;
    const flicker = opacity > 0.05 ? (0.35 + Math.random() * 0.65) * (Math.sin(clock.elapsedTime * 45) * 0.15 + 0.85) : 0;
    const py = offset[1];
    const pz = z + offset[2];
    if (lightRef.current) {
      lightRef.current.position.set(offset[0], py, pz);
      lightRef.current.intensity = flicker * 1.6 * opacity;
    }
    if (sphereRef.current) {
      sphereRef.current.position.set(offset[0], py, pz);
      const mat = sphereRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = flicker * opacity;
    }
  });

  return (
    <group>
      <pointLight ref={lightRef} color="#bfe8ff" distance={4.5} />
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color="#eaf7ff" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
