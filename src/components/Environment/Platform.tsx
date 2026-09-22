import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { concreteNormalTexture, concreteTexture } from "../../materials/presets";
import { useDetailMap } from "../../materials/useDetailMap";

const SURFACE_START = new THREE.Color("#9a876a");
const SURFACE_END = new THREE.Color("#a8adb2");
const LAMP_WARM = new THREE.Color("#ffc978");
const LAMP_COOL = new THREE.Color("#eaf4ff");

const LAMP_Z_POSITIONS = [-8, 0, 8];
/** Float marks and aggregate in the platform slab — shallow, but it kills the plastic sheen. */
const CONCRETE_RELIEF = new THREE.Vector2(0.7, 0.7);

interface PlatformProps {
  progressRef: React.MutableRefObject<number>;
}

/** A raised platform walkway running alongside the track, with lamp posts that shift from warm gaslight to cool LED. */
export function Platform({ progressRef }: PlatformProps) {
  const surfaceMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lampMatRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const lampLightRef = useRef<THREE.PointLight>(null);

  const surfaceMap = useDetailMap(concreteTexture, 2, 18);
  const surfaceNormalMap = useDetailMap(concreteNormalTexture, 2, 18);

  useFrame(() => {
    const p = progressRef.current;
    surfaceMatRef.current?.color.lerpColors(SURFACE_START, SURFACE_END, p);
    const lampColor = LAMP_WARM.clone().lerp(LAMP_COOL, p);
    for (const mat of lampMatRefs.current) {
      mat?.emissive.copy(lampColor);
    }
    if (lampLightRef.current) {
      lampLightRef.current.color.copy(lampColor);
      lampLightRef.current.intensity = THREE.MathUtils.lerp(1.1, 0.7, p);
    }
  });

  return (
    <group position={[-4.4, 0, 2]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.5, 22]} />
        <meshStandardMaterial ref={surfaceMatRef} color={SURFACE_START} map={surfaceMap} normalMap={surfaceNormalMap} normalScale={CONCRETE_RELIEF} roughness={0.88} />
      </mesh>
      <mesh position={[1.15, 0.51, 0]}>
        <boxGeometry args={[0.15, 0.02, 22]} />
        <meshStandardMaterial color="#e8c93a" roughness={0.7} />
      </mesh>

      {LAMP_Z_POSITIONS.map((z, i) => (
        <group key={z} position={[0.9, 0.5, z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.04, 0.05, 2.2, 8]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <sphereGeometry args={[0.14, 12, 12]} />
            <meshStandardMaterial
              ref={(el) => (lampMatRefs.current[i] = el)}
              color="#fff8e6"
              emissive={LAMP_WARM}
              emissiveIntensity={0.95}
            />
          </mesh>
        </group>
      ))}
      <pointLight ref={lampLightRef} position={[0.9, 1.7, 0]} color={LAMP_WARM} intensity={1.1} distance={9} decay={2} />
    </group>
  );
}
