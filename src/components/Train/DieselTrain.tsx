import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { Wheel, Carriage } from "./TrainParts";
import { TrainModel } from "../../assets/TrainModel";

interface DieselTrainProps {
  speed: number;
}

/** Mid-era diesel locomotive: boxy hood, sloped cab, roof grilles, and passenger carriages. */
export function DieselTrain({ speed }: DieselTrainProps) {
  const headlightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (headlightRef.current) {
      headlightRef.current.intensity = 2.2 + Math.sin(clock.elapsedTime * 30) * 0.08;
    }
  });

  return (
    <TrainModel
      src="/models/train/diesel.glb"
      fallback={
    <group>
      {/* Main hood/body */}
      <mesh position={[0, 1.35, 0.2]} castShadow receiveShadow>
        <boxGeometry args={[2, 1.7, 5.2]} />
        <meshStandardMaterial color="#c9591a" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Roof engine grilles */}
      {[-1.4, -0.4, 0.6, 1.6].map((z) => (
        <mesh key={z} position={[0, 2.21, z]}>
          <boxGeometry args={[1.5, 0.04, 0.35]} />
          <meshStandardMaterial color="#1c1c1c" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      {/* Lower body vents */}
      {[-1.2, 0, 1.2].map((z) => (
        <mesh key={z} position={[1.005, 0.9, z]}>
          <boxGeometry args={[0.02, 0.55, 0.5]} />
          <meshStandardMaterial color="#5a2f10" metalness={0.5} roughness={0.6} />
        </mesh>
      ))}
      {/* Nose / cab */}
      <mesh position={[0, 1.75, -2.9]} castShadow receiveShadow>
        <boxGeometry args={[2, 1.9, 1.3]} />
        <meshStandardMaterial color="#c9591a" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 2.05, -3.35]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[1.8, 0.55, 0.08]} />
        <meshPhysicalMaterial color="#3a5a68" emissive="#9fd6e8" emissiveIntensity={0.15} roughness={0.08} metalness={0.15} clearcoat={1} clearcoatRoughness={0.06} />
      </mesh>
      {/* Roof stripe */}
      <mesh position={[0, 2.25, -0.4]} castShadow>
        <boxGeometry args={[2.05, 0.12, 6.6]} />
        <meshStandardMaterial color="#2c2c2c" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Front headlight cluster */}
      <mesh position={[0, 1.55, -3.56]}>
        <boxGeometry args={[1.2, 0.25, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.35, 1.55, -3.6]}>
        <circleGeometry args={[0.09, 16]} />
        <meshStandardMaterial color="#fff3c4" emissive="#fff3c4" emissiveIntensity={1.8} />
      </mesh>
      <mesh position={[0.35, 1.55, -3.6]}>
        <circleGeometry args={[0.09, 16]} />
        <meshStandardMaterial color="#fff3c4" emissive="#fff3c4" emissiveIntensity={1.8} />
      </mesh>
      <pointLight ref={headlightRef} position={[0, 1.55, -4]} color="#fff3c4" intensity={2.2} distance={7} decay={2} />
      {/* Front coupler */}
      <mesh position={[0, 0.7, -3.7]}>
        <boxGeometry args={[0.18, 0.18, 0.5]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.5} />
      </mesh>
      {/* Side stripe */}
      <mesh position={[1.01, 1.0, 0.2]}>
        <boxGeometry args={[0.02, 0.3, 5.2]} />
        <meshStandardMaterial color="#f5c542" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[-1.01, 1.0, 0.2]}>
        <boxGeometry args={[0.02, 0.3, 5.2]} />
        <meshStandardMaterial color="#f5c542" metalness={0.35} roughness={0.45} />
      </mesh>
      {/* Exhaust stack */}
      <mesh position={[0.35, 2.42, 1.5]}>
        <cylinderGeometry args={[0.13, 0.15, 0.35, 12]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.55} roughness={0.55} />
      </mesh>

      {/* Bogie frames + wheels */}
      {[[-1.9, -1.0], [1.0, 1.9]].map(([za, zb]) => (
        <group key={za}>
          <mesh position={[0.95, 0.48, (za + zb) / 2]} castShadow>
            <boxGeometry args={[0.14, 0.35, Math.abs(zb - za) + 0.5]} />
            <meshStandardMaterial color="#1f1f1f" metalness={0.5} roughness={0.55} />
          </mesh>
          <mesh position={[-0.95, 0.48, (za + zb) / 2]} castShadow>
            <boxGeometry args={[0.14, 0.35, Math.abs(zb - za) + 0.5]} />
            <meshStandardMaterial color="#1f1f1f" metalness={0.5} roughness={0.55} />
          </mesh>
          <Wheel position={[0.95, 0.5, za]} radius={0.5} speed={speed} />
          <Wheel position={[-0.95, 0.5, za]} radius={0.5} speed={speed} />
          <Wheel position={[0.95, 0.5, zb]} radius={0.5} speed={speed} />
          <Wheel position={[-0.95, 0.5, zb]} radius={0.5} speed={speed} />
        </group>
      ))}

      {/* Carriages */}
      <Carriage
        position={[0, 0, 6.1]}
        color="#e7e7e7"
        roofColor="#c9591a"
        windowColor="#9fd6e8"
        metalness={0.35}
        roughness={0.45}
        speed={speed}
      />
      <Carriage
        position={[0, 0, 9.9]}
        color="#e7e7e7"
        roofColor="#c9591a"
        windowColor="#9fd6e8"
        metalness={0.35}
        roughness={0.45}
        speed={speed}
      />
    </group>
      }
    />
  );
}
