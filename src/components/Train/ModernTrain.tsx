import { useMemo } from "react";
import { Wheel, Carriage } from "./TrainParts";
import { brushedMetalTexture } from "../../materials/presets";
import { TrainModel } from "../../assets/TrainModel";

interface ModernTrainProps {
  speed: number;
}

const WINDOW_ZS = [0.4, 1.4, 2.4, 3.4];

/** Modern high-speed train: long aerodynamic nose, low sleek body, LED headlamp, and skirted wheels. */
export function ModernTrain({ speed }: ModernTrainProps) {
  const brushedMap = useMemo(() => {
    const tex = brushedMetalTexture().clone();
    tex.repeat.set(4, 3);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <TrainModel
      src="/models/train/modern.glb"
      fallback={
    <group>
      {/* Body */}
      <mesh position={[0, 1.1, 0.6]} castShadow receiveShadow>
        <boxGeometry args={[1.85, 1.3, 6]} />
        <meshPhysicalMaterial color="#f2f4f6" roughnessMap={brushedMap} metalness={0.6} roughness={0.18} clearcoat={0.6} clearcoatRoughness={0.15} />
      </mesh>
      {/* Long aerodynamic nose */}
      <mesh position={[0, 1.1, -3.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.92, 2.8, 28]} />
        <meshPhysicalMaterial color="#f2f4f6" metalness={0.6} roughness={0.12} clearcoat={0.7} clearcoatRoughness={0.1} />
      </mesh>
      {/* Cockpit visor */}
      <mesh position={[0, 1.35, -2.55]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[1.3, 0.4, 0.06]} />
        <meshPhysicalMaterial color="#101c24" roughness={0.05} metalness={0.2} clearcoat={1} clearcoatRoughness={0.04} />
      </mesh>
      {/* LED headlamp strip */}
      <mesh position={[0, 0.95, -4.55]}>
        <boxGeometry args={[0.7, 0.06, 0.05]} />
        <meshStandardMaterial color="#eaf7ff" emissive="#eaf7ff" emissiveIntensity={2.2} />
      </mesh>
      {/* Segmented window band */}
      {WINDOW_ZS.map((z) => (
        <mesh key={z} position={[0, 1.45, z]}>
          <boxGeometry args={[1.92, 0.4, 0.72]} />
          <meshPhysicalMaterial color="#274a63" emissive="#bfe3f2" emissiveIntensity={0.15} roughness={0.05} metalness={0.15} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
      ))}
      {[-0.1, 0.9, 1.9, 2.9, 3.9].map((z) => (
        <mesh key={z} position={[0, 1.45, z]}>
          <boxGeometry args={[1.94, 0.44, 0.08]} />
          <meshStandardMaterial color="#c7ccd1" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      {/* Accent stripe */}
      <mesh position={[0, 0.75, 0.6]}>
        <boxGeometry args={[1.87, 0.16, 6.02]} />
        <meshStandardMaterial color="#d21e3c" metalness={0.5} roughness={0.25} />
      </mesh>
      {/* Skirt hiding undercarriage */}
      <mesh position={[0, 0.35, 0.6]}>
        <boxGeometry args={[1.9, 0.42, 6.4]} />
        <meshStandardMaterial color="#3a4046" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Coupler cover */}
      <mesh position={[0, 0.7, -4.5]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Low-profile pantograph */}
      <group position={[0, 1.75, 2.0]}>
        <mesh>
          <boxGeometry args={[0.4, 0.05, 0.24]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[-0.3, 0.35, 0]} rotation={[0, 0, 0.55]}>
          <cylinderGeometry args={[0.025, 0.025, 0.7, 8]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0.3, 0.35, 0]} rotation={[0, 0, -0.55]}>
          <cylinderGeometry args={[0.025, 0.025, 0.7, 8]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.85, 0.04, 0.04]} />
          <meshStandardMaterial color="#c9a86a" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* Skirted bogie wheels (partially hidden, visible sliver only) */}
      {[-2.4, -0.4, 1.6, 3.2].map((z) => (
        <group key={z}>
          <Wheel position={[0.8, 0.32, z]} radius={0.32} speed={speed} />
          <Wheel position={[-0.8, 0.32, z]} radius={0.32} speed={speed} />
        </group>
      ))}

      {/* Carriages */}
      <Carriage
        position={[0, 0, 7.4]}
        length={4}
        width={1.85}
        height={2.1}
        color="#f2f4f6"
        roofColor="#d21e3c"
        windowColor="#bfe3f2"
        metalness={0.5}
        roughness={0.2}
        speed={speed}
      />
      <Carriage
        position={[0, 0, 11.8]}
        length={4}
        width={1.85}
        height={2.1}
        color="#f2f4f6"
        roofColor="#d21e3c"
        windowColor="#bfe3f2"
        metalness={0.5}
        roughness={0.2}
        speed={speed}
      />
    </group>
      }
    />
  );
}
