import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TrainMotionState } from "../components/Train/TrainCarrier";

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  life: number;
}

interface ParticlePuffsProps {
  /** Shared position/opacity of the train this emitter is attached to. */
  stateRef: React.MutableRefObject<TrainMotionState>;
  /** Local offset from the train's origin (e.g. chimney/exhaust position). */
  offset: [number, number, number];
  count?: number;
  color?: string;
  riseSpeed?: number;
  spread?: number;
  life?: number;
  maxScale?: number;
  baseOpacity?: number;
}

/** Lightweight puff/smoke particle system: a small pool of fading, rising spheres. */
export function ParticlePuffs({
  stateRef,
  offset,
  count = 9,
  color = "#f2f2f2",
  riseSpeed = 1.2,
  spread = 0.4,
  life = 2.2,
  maxScale = 0.8,
  baseOpacity = 0.5,
}: ParticlePuffsProps) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const particles = useRef<Particle[]>(
    Array.from({ length: count }, (_, i) => {
      const originZ = stateRef.current.z + offset[2];
      return {
        pos: new THREE.Vector3(offset[0], offset[1], originZ),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          riseSpeed * (0.8 + Math.random() * 0.4),
          (Math.random() - 0.5) * spread * 0.5,
        ),
        age: (i / count) * life,
        life,
      };
    }),
  );

  useFrame((_, delta) => {
    const { z: trainZ, opacity: trainOpacity } = stateRef.current;
    particles.current.forEach((p, i) => {
      p.age += delta;
      if (p.age >= p.life) {
        p.age = 0;
        p.pos.set(offset[0] + (Math.random() - 0.5) * spread * 0.4, offset[1], trainZ + offset[2]);
        p.vel.set(
          (Math.random() - 0.5) * spread,
          riseSpeed * (0.8 + Math.random() * 0.4),
          (Math.random() - 0.5) * spread * 0.5,
        );
      }
      p.pos.addScaledVector(p.vel, delta);

      const mesh = meshRefs.current[i];
      if (!mesh) return;
      mesh.position.copy(p.pos);
      const t = p.age / p.life;
      const scale = Math.max(maxScale * Math.sin(Math.min(t, 1) * Math.PI), 0.001);
      mesh.scale.setScalar(scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = trainOpacity * baseOpacity * (1 - t * 0.4);
    });
  });

  return (
    <group>
      {particles.current.map((_, i) => (
        <mesh key={i} ref={(el) => (meshRefs.current[i] = el)}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
