import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const COUNT = 16;
/** Speed (units/sec) at which streaks reach full intensity. */
const MAX_SPEED = 14;

interface StreakDatum {
  x: number;
  y: number;
  z: number;
}

interface SpeedLinesEffectProps {
  /** Current train speed in units/sec, read every frame (not a React prop) so callers can drive it imperatively. */
  speedRef: React.MutableRefObject<number>;
}

/** Fast bright streaks that whip past the camera to sell high-speed motion. Intensity follows `speedRef`. */
export function SpeedLinesEffect({ speedRef }: SpeedLinesEffectProps) {
  const { camera } = useThree();
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const data = useRef<StreakDatum[]>(
    Array.from({ length: COUNT }, () => ({
      x: (Math.random() - 0.5) * 7,
      y: (Math.random() - 0.5) * 3 + 1,
      z: Math.random() * -14 - 2,
    })),
  );

  useFrame((_, delta) => {
    const intensity = Math.min(Math.max(speedRef.current / MAX_SPEED, 0), 1);

    data.current.forEach((d, i) => {
      d.z += (6 + i * 0.3) * delta;
      if (d.z > 2) {
        d.z = -16;
        d.x = (Math.random() - 0.5) * 7;
        d.y = (Math.random() - 0.5) * 3 + 1;
      }
      const mesh = meshRefs.current[i];
      if (!mesh) return;
      mesh.position.set(camera.position.x + d.x, camera.position.y + d.y, camera.position.z + d.z);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = intensity * 0.5;
    });
  });

  return (
    <group>
      {data.current.map((_, i) => (
        <mesh key={i} ref={(el) => (meshRefs.current[i] = el)}>
          <boxGeometry args={[0.03, 0.03, 1.6]} />
          <meshBasicMaterial color="#dff2ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
