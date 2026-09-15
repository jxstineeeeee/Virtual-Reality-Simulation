import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { woodGrainTexture } from "../../materials/presets";

const WALL_START = new THREE.Color("#6b5638");
const WALL_END = new THREE.Color("#d7dbe0");
const ROOF_START = new THREE.Color("#3a2a1c");
const ROOF_END = new THREE.Color("#2f3946");
const SIGN_WARM = new THREE.Color("#ffcf8a");
const SIGN_COOL = new THREE.Color("#7fd4ff");

interface StationProps {
  progressRef: React.MutableRefObject<number>;
}

/** A small trackside station building; grows a modern canopy and digital signage as `progressRef` advances. */
export function Station({ progressRef }: StationProps) {
  const wallMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const roofMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const canopyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const waterTowerRef = useRef<THREE.Group>(null);
  const signMatRef = useRef<THREE.MeshStandardMaterial>(null);

  const wallMap = useMemo(() => {
    const tex = woodGrainTexture().clone();
    tex.repeat.set(3, 2);
    tex.needsUpdate = true;
    return tex;
  }, []);

  useFrame(() => {
    const p = progressRef.current;
    wallMatRef.current?.color.lerpColors(WALL_START, WALL_END, p);
    roofMatRef.current?.color.lerpColors(ROOF_START, ROOF_END, p);
    if (canopyMatRef.current) {
      canopyMatRef.current.opacity = Math.min(Math.max((p - 0.4) / 0.05, 0), 1);
    }
    if (waterTowerRef.current) {
      const towerOpacity = 1 - Math.min(Math.max((p - 0.15) / 0.1, 0), 1);
      waterTowerRef.current.visible = towerOpacity > 0.02;
      waterTowerRef.current.scale.setScalar(0.85 + towerOpacity * 0.15);
    }
    if (signMatRef.current) {
      signMatRef.current.color.lerpColors(SIGN_WARM, SIGN_COOL, p);
      signMatRef.current.emissive.lerpColors(SIGN_WARM, SIGN_COOL, p);
    }
  });

  return (
    <group position={[-6.2, 0, -3]}>
      <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 2.8, 4.2]} />
        <meshStandardMaterial ref={wallMatRef} color={WALL_START} map={wallMap} roughness={0.85} />
      </mesh>
      {/* Windows */}
      <mesh position={[1.62, 1.6, -1.1]}>
        <boxGeometry args={[0.05, 1, 1]} />
        <meshPhysicalMaterial color="#5a7a8a" emissive="#bcd9e8" emissiveIntensity={0.25} roughness={0.08} metalness={0.1} clearcoat={1} clearcoatRoughness={0.06} />
      </mesh>
      <mesh position={[1.62, 1.6, 1.1]}>
        <boxGeometry args={[0.05, 1, 1]} />
        <meshPhysicalMaterial color="#5a7a8a" emissive="#bcd9e8" emissiveIntensity={0.25} roughness={0.08} metalness={0.1} clearcoat={1} clearcoatRoughness={0.06} />
      </mesh>
      {/* Door */}
      <mesh position={[1.62, 0.9, 0]}>
        <boxGeometry args={[0.05, 1.8, 1]} />
        <meshStandardMaterial color="#241a10" roughness={0.7} />
      </mesh>

      <mesh position={[0, 3.05, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[3, 1.2, 4]} />
        <meshStandardMaterial ref={roofMatRef} color={ROOF_START} roughness={0.7} />
      </mesh>

      {/* Modern platform canopy, fades in from the electric era onward */}
      <mesh position={[2.6, 3.0, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.1, 5]} />
        <meshStandardMaterial ref={canopyMatRef} color="#2f3946" metalness={0.4} roughness={0.4} transparent opacity={0} />
      </mesh>
      {[-2, 0, 2].map((z) => (
        <mesh key={z} position={[2.6, 1.5, z]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 3, 8]} />
          <meshStandardMaterial color="#444" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}

      {/* Steam-era water tower, present early and removed as infrastructure modernizes */}
      <group ref={waterTowerRef} position={[-2.6, 0, 1.5]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 2.8, 8]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.6} />
        </mesh>
        <mesh position={[0.5, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 2.8, 8]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.6} />
        </mesh>
        <mesh position={[0.25, 3.0, 0.25]} castShadow>
          <cylinderGeometry args={[1.1, 1.1, 1.4, 16]} />
          <meshStandardMaterial color="#4a3a28" roughness={0.85} />
        </mesh>
        <mesh position={[0.25, 3.78, 0.25]} castShadow>
          <coneGeometry args={[1.25, 0.6, 16]} />
          <meshStandardMaterial color="#2f2318" roughness={0.8} />
        </mesh>
      </group>

      {/* Trackside sign: warm painted board in early eras, cool backlit digital panel later */}
      <group position={[3.6, 0, -2.5]}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 2.2, 8]} />
          <meshStandardMaterial color="#333" metalness={0.4} roughness={0.6} />
        </mesh>
        <mesh position={[0, 2.0, 0]}>
          <boxGeometry args={[1.1, 0.5, 0.05]} />
          <meshStandardMaterial ref={signMatRef} color={SIGN_WARM} emissive={SIGN_WARM} emissiveIntensity={0.5} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}
