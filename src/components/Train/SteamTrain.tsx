import { useMemo } from "react";
import { Wheel, Carriage, ConnectingRod } from "./TrainParts";
import { ironGrimeTexture } from "../../materials/presets";
import { TrainModel } from "../../assets/TrainModel";

interface SteamTrainProps {
  speed: number;
}

const DRIVER_RADIUS = 0.55;
const DRIVER_Y = 0.55;
const DRIVER_Z1 = -0.6;
const DRIVER_Z2 = 0.4;

/** Early-era steam locomotive: riveted boiler, chimney, cab, coal tender, and two wooden carriages. */
export function SteamTrain({ speed }: SteamTrainProps) {
  const grimeMap = useMemo(() => {
    const tex = ironGrimeTexture().clone();
    tex.repeat.set(3, 1);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <TrainModel
      src="/models/train/steam.glb"
      fallback={
    <group>
      {/* Boiler */}
      <mesh position={[0, 1.1, -0.5]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.5, 0.5, 4, 24]} />
        <meshStandardMaterial color="#2b2b2b" roughnessMap={grimeMap} metalness={0.6} roughness={0.55} />
      </mesh>
      {/* Boiler bands */}
      {[-2.2, -1.4, -0.6, 0.2, 1.0].map((z) => (
        <mesh key={z} position={[0, 1.1, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.515, 0.515, 0.05, 24]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* Handrail pipe along the boiler */}
      <mesh position={[0.42, 1.45, -0.6]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 3.4, 8]} />
        <meshStandardMaterial color="#8a8a86" metalness={0.7} roughness={0.35} />
      </mesh>
      {/* Smoke box front plate */}
      <mesh position={[0, 1.1, -2.55]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.53, 0.53, 0.25, 24]} />
        <meshStandardMaterial color="#1c1c1c" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Headlamp */}
      <mesh position={[0, 1.42, -2.62]}>
        <cylinderGeometry args={[0.16, 0.19, 0.22, 16]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.42, -2.74]}>
        <circleGeometry args={[0.14, 16]} />
        <meshStandardMaterial color="#fff3c4" emissive="#ffdf8c" emissiveIntensity={1.6} />
      </mesh>
      {/* Chimney */}
      <mesh position={[0, 1.8, -2.15]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 0.7, 16]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.17, -2.15]}>
        <cylinderGeometry args={[0.22, 0.18, 0.1, 16]} />
        <meshStandardMaterial color="#0f0f0f" metalness={0.5} roughness={0.6} />
      </mesh>
      {/* Steam dome + safety valves */}
      <mesh position={[0, 1.62, -0.9]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.35, 16]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.85, -0.9]}>
        <cylinderGeometry args={[0.05, 0.05, 0.15, 8]} />
        <meshStandardMaterial color="#8a8a86" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Cow catcher */}
      <mesh position={[0, 0.5, -2.95]} rotation={[0.5, 0, 0]}>
        <boxGeometry args={[1.1, 0.5, 0.1]} />
        <meshStandardMaterial color="#171717" metalness={0.4} roughness={0.7} />
      </mesh>
      {/* Cylinder blocks flanking the front driving wheels */}
      <mesh position={[0.68, 0.55, -1.7]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.55, 16]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[-0.68, 0.55, -1.7]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.55, 16]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Cab */}
      <mesh position={[0, 1.35, 1.6]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 1.6, 1.4]} />
        <meshStandardMaterial color="#5c1f1f" metalness={0.3} roughness={0.65} />
      </mesh>
      <mesh position={[0.76, 1.5, 1.6]}>
        <boxGeometry args={[0.02, 0.55, 0.6]} />
        <meshPhysicalMaterial color="#3a5560" emissive="#cfe6f0" emissiveIntensity={0.2} roughness={0.1} metalness={0.15} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[-0.76, 1.5, 1.6]}>
        <boxGeometry args={[0.02, 0.55, 0.6]} />
        <meshPhysicalMaterial color="#3a5560" emissive="#cfe6f0" emissiveIntensity={0.2} roughness={0.1} metalness={0.15} clearcoat={1} clearcoatRoughness={0.08} />
      </mesh>
      <mesh position={[0, 2.22, 1.6]} castShadow>
        <boxGeometry args={[1.6, 0.12, 1.5]} />
        <meshStandardMaterial color="#241010" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Footplate base */}
      <mesh position={[0, 0.55, 0.5]} receiveShadow>
        <boxGeometry args={[1.4, 0.3, 4.6]} />
        <meshStandardMaterial color="#1f1f1f" metalness={0.5} roughness={0.6} />
      </mesh>

      {/* Driving wheels (spoked) */}
      <Wheel position={[0.86, DRIVER_Y, DRIVER_Z1]} radius={DRIVER_RADIUS} speed={speed} spoked />
      <Wheel position={[-0.86, DRIVER_Y, DRIVER_Z1]} radius={DRIVER_RADIUS} speed={speed} spoked />
      <Wheel position={[0.86, DRIVER_Y, DRIVER_Z2]} radius={DRIVER_RADIUS} speed={speed} spoked />
      <Wheel position={[-0.86, DRIVER_Y, DRIVER_Z2]} radius={DRIVER_RADIUS} speed={speed} spoked />
      {/* Coupling/connecting rods, synced to the driving wheel rotation */}
      <ConnectingRod z1={DRIVER_Z1} z2={DRIVER_Z2} wheelY={DRIVER_Y} radius={DRIVER_RADIUS} speed={speed} xOffset={0.95} />
      <ConnectingRod z1={DRIVER_Z1} z2={DRIVER_Z2} wheelY={DRIVER_Y} radius={DRIVER_RADIUS} speed={speed} xOffset={-0.95} />
      {/* Pilot wheels */}
      <Wheel position={[0.7, 0.36, -2.15]} radius={0.36} speed={speed} />
      <Wheel position={[-0.7, 0.36, -2.15]} radius={0.36} speed={speed} />

      {/* Tender (coal/water car) */}
      <group position={[0, 0, 3.4]}>
        <mesh position={[0, 0.85, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 1.1, 2.2]} />
          <meshStandardMaterial color="#232323" metalness={0.45} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.32, -0.3]} castShadow>
          <boxGeometry args={[1.3, 0.35, 1.3]} />
          <meshStandardMaterial color="#151515" roughness={0.95} />
        </mesh>
        <Wheel position={[0.78, 0.4, -0.7]} radius={0.4} speed={speed} />
        <Wheel position={[-0.78, 0.4, -0.7]} radius={0.4} speed={speed} />
        <Wheel position={[0.78, 0.4, 0.7]} radius={0.4} speed={speed} />
        <Wheel position={[-0.78, 0.4, 0.7]} radius={0.4} speed={speed} />
      </group>

      {/* Carriages */}
      <Carriage
        position={[0, 0, 6.3]}
        color="#6b4423"
        roofColor="#3a2a1c"
        windowColor="#e8d9a8"
        metalness={0.15}
        roughness={0.75}
        speed={speed}
      />
      <Carriage
        position={[0, 0, 10.1]}
        color="#6b4423"
        roofColor="#3a2a1c"
        windowColor="#e8d9a8"
        metalness={0.15}
        roughness={0.75}
        speed={speed}
      />
    </group>
      }
    />
  );
}
