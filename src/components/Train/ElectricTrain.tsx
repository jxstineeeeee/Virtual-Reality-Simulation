import { Wheel, Carriage } from "./TrainParts";
import { TrainModel } from "../../assets/TrainModel";

interface ElectricTrainProps {
  speed: number;
}

const WINDOW_ZS = [-0.4, 0.5, 1.4, 2.5];

/** Electric-era train: streamlined nose, roof pantograph, segmented glazing, and sleek carriages. */
export function ElectricTrain({ speed }: ElectricTrainProps) {
  return (
    <TrainModel
      src="/models/train/electric.glb"
      fallback={
    <group>
      {/* Body */}
      <mesh position={[0, 1.25, 0.3]} castShadow receiveShadow>
        <boxGeometry args={[1.9, 1.5, 5.4]} />
        <meshStandardMaterial color="#1f5fa8" metalness={0.55} roughness={0.28} />
      </mesh>
      {/* Streamlined nose */}
      <mesh position={[0, 1.25, -2.95]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[0.95, 1.7, 24]} />
        <meshStandardMaterial color="#1f5fa8" metalness={0.55} roughness={0.22} />
      </mesh>
      {/* Cockpit windshield */}
      <mesh position={[0, 1.55, -2.15]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[1.5, 0.5, 0.06]} />
        <meshPhysicalMaterial color="#274a63" emissive="#bfe3f2" emissiveIntensity={0.12} roughness={0.07} metalness={0.15} clearcoat={1} clearcoatRoughness={0.05} />
      </mesh>
      {/* Individually paned window band */}
      {WINDOW_ZS.map((z) => (
        <mesh key={z} position={[0, 1.55, z]}>
          <boxGeometry args={[1.94, 0.42, 0.72]} />
          <meshPhysicalMaterial color="#274a63" emissive="#bfe3f2" emissiveIntensity={0.18} roughness={0.06} metalness={0.15} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
      ))}
      {/* Window pillars */}
      {[-0.85, 0.05, 0.95, 1.85, 2.95].map((z) => (
        <mesh key={z} position={[0, 1.55, z]}>
          <boxGeometry args={[1.96, 0.46, 0.08]} />
          <meshStandardMaterial color="#123a66" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Door */}
      <mesh position={[0, 0.95, -1.15]}>
        <boxGeometry args={[1.96, 1.35, 0.85]} />
        <meshStandardMaterial color="#173e6e" metalness={0.4} roughness={0.45} />
      </mesh>
      {/* Belly skirt */}
      <mesh position={[0, 0.55, 0.3]}>
        <boxGeometry args={[1.95, 0.35, 5.6]} />
        <meshStandardMaterial color="#123a66" metalness={0.45} roughness={0.4} />
      </mesh>
      {/* Coupler */}
      <mesh position={[0, 0.7, -3.75]}>
        <boxGeometry args={[0.16, 0.16, 0.4]} />
        <meshStandardMaterial color="#111" metalness={0.6} roughness={0.5} />
      </mesh>

      {/* Pantograph */}
      <group position={[0, 1.98, 1.0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.06, 0.3]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-0.35, 0.4, 0]} rotation={[0, 0, 0.6]}>
          <cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.35, 0.4, 0]} rotation={[0, 0, -0.6]}>
          <cylinderGeometry args={[0.03, 0.03, 0.9, 8]} />
          <meshStandardMaterial color="#3a3a3a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[1, 0.05, 0.05]} />
          <meshStandardMaterial color="#c9a86a" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>

      {/* Bogie frames + wheels */}
      {[[-2.1, -0.9], [0.9, 2.1]].map(([za, zb]) => (
        <group key={za}>
          <mesh position={[0.85, 0.4, (za + zb) / 2]}>
            <boxGeometry args={[0.1, 0.28, Math.abs(zb - za) + 0.4]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[-0.85, 0.4, (za + zb) / 2]}>
            <boxGeometry args={[0.1, 0.28, Math.abs(zb - za) + 0.4]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.5} />
          </mesh>
          <Wheel position={[0.85, 0.42, za]} radius={0.42} speed={speed} />
          <Wheel position={[-0.85, 0.42, za]} radius={0.42} speed={speed} />
          <Wheel position={[0.85, 0.42, zb]} radius={0.42} speed={speed} />
          <Wheel position={[-0.85, 0.42, zb]} radius={0.42} speed={speed} />
        </group>
      ))}

      {/* Carriages */}
      <Carriage
        position={[0, 0, 6.4]}
        color="#e9edf2"
        roofColor="#1f5fa8"
        windowColor="#bfe3f2"
        metalness={0.4}
        roughness={0.3}
        speed={speed}
      />
      <Carriage
        position={[0, 0, 10.2]}
        color="#e9edf2"
        roofColor="#1f5fa8"
        windowColor="#bfe3f2"
        metalness={0.4}
        roughness={0.3}
        speed={speed}
      />
    </group>
      }
    />
  );
}
