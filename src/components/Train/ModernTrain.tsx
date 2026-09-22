import { useMemo } from "react";
import { Wheel, Carriage } from "./TrainParts";
import { brushedMetalTexture } from "../../materials/presets";
import { TrainModel } from "../../assets/TrainModel";

interface ModernTrainProps {
  speed: number;
  /**
   * The driverless unit of the closing scene. There is no cab crew to show, so what says so is what
   * says so on a real automated train: a blank, unlit cab window and a status band along the flank
   * that is lit while the train is under automatic control.
   */
  autonomous?: boolean;
  /**
   * `shinkansen` is the 1964 unit the whole high-speed stage descends from: ivory with a blue belt,
   * and a short blunt nose rather than today's long knife — the aerodynamics came later. Everything
   * else about the shell is shared, because structurally that is the truth of it.
   */
  livery?: keyof typeof LIVERIES;
}

const WINDOW_ZS = [0.4, 1.4, 2.4, 3.4];
/** Automatic-operation indicator green, the colour the signalling standards actually reserve for it. */
const AUTO_GREEN = "#4fe08a";

interface Livery {
  body: string;
  stripe: string;
  window: string;
  windowGlow: string;
  /** Length and radius of the nose cone. The 0-series is stubby; a present-day unit is not. */
  noseLength: number;
  noseRadius: number;
}

const LIVERIES = {
  modern: { body: "#f2f4f6", stripe: "#d21e3c", window: "#274a63", windowGlow: "#bfe3f2", noseLength: 2.8, noseRadius: 0.92 },
  shinkansen: { body: "#f4f1e4", stripe: "#1c5ea8", window: "#1f3f5c", windowGlow: "#cfe4ef", noseLength: 1.7, noseRadius: 0.95 },
} satisfies Record<string, Livery>;

/** Modern high-speed train: long aerodynamic nose, low sleek body, LED headlamp, and skirted wheels. */
export function ModernTrain({ speed, autonomous = false, livery = "modern" }: ModernTrainProps) {
  const paint = LIVERIES[livery];
  // The cone starts 0.6m inside the body and runs forward; everything on the front end is placed
  // off the resulting tip, so swapping livery moves the lamp, coupler and visor with the nose.
  const noseBase = -1.8;
  const noseZ = noseBase - paint.noseLength / 2;
  const noseTip = noseBase - paint.noseLength;
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
        <meshPhysicalMaterial color={paint.body} roughnessMap={brushedMap} metalness={0.6} roughness={0.18} clearcoat={0.6} clearcoatRoughness={0.15} />
      </mesh>
      {/* Nose: long and knife-like today, short and blunt on the 1964 unit */}
      <mesh position={[0, 1.1, noseZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[paint.noseRadius, paint.noseLength, 28]} />
        <meshPhysicalMaterial color={paint.body} metalness={0.6} roughness={0.12} clearcoat={0.7} clearcoatRoughness={0.1} />
      </mesh>
      {/* Cockpit visor. On the autonomous unit it is darker still and lit by nothing inside. */}
      <mesh position={[0, 1.35, noseTip + paint.noseLength * 0.73]} rotation={[0.28, 0, 0]}>
        <boxGeometry args={[1.3, 0.4, 0.06]} />
        <meshPhysicalMaterial color={autonomous ? "#080d12" : "#101c24"} roughness={0.05} metalness={0.2} clearcoat={1} clearcoatRoughness={0.04} />
      </mesh>
      {autonomous && (
        <>
          {/* Automatic-operation status band down the flank */}
          {([-1, 1] as const).map((side) => (
            <mesh key={side} position={[side * 0.94, 0.62, 0.6]}>
              <boxGeometry args={[0.02, 0.05, 5.6]} />
              <meshStandardMaterial color={AUTO_GREEN} emissive={AUTO_GREEN} emissiveIntensity={1.8} toneMapped={false} />
            </mesh>
          ))}
          {/* ...and repeated across the nose, where a driver would otherwise be sitting */}
          <mesh position={[0, 1.12, noseTip + 0.2]}>
            <boxGeometry args={[0.5, 0.05, 0.04]} />
            <meshStandardMaterial color={AUTO_GREEN} emissive={AUTO_GREEN} emissiveIntensity={1.8} toneMapped={false} />
          </mesh>
        </>
      )}
      {/* Headlamps: an LED strip on the modern unit, a pair of round lamps on the 1964 one */}
      {livery === "shinkansen" ? (
        ([-1, 1] as const).map((side) => (
          <mesh key={side} position={[side * 0.3, 1.0, noseTip + 0.06]}>
            <circleGeometry args={[0.12, 16]} />
            <meshStandardMaterial color="#fff6e0" emissive="#fff6e0" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        ))
      ) : (
        <mesh position={[0, 0.95, noseTip + 0.05]}>
          <boxGeometry args={[0.7, 0.06, 0.05]} />
          <meshStandardMaterial color="#eaf7ff" emissive="#eaf7ff" emissiveIntensity={2.2} />
        </mesh>
      )}
      {/* Segmented window band */}
      {WINDOW_ZS.map((z) => (
        <mesh key={z} position={[0, 1.45, z]}>
          <boxGeometry args={[1.92, 0.4, 0.72]} />
          <meshPhysicalMaterial color={paint.window} emissive={paint.windowGlow} emissiveIntensity={0.15} roughness={0.05} metalness={0.15} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
      ))}
      {[-0.1, 0.9, 1.9, 2.9, 3.9].map((z) => (
        <mesh key={z} position={[0, 1.45, z]}>
          <boxGeometry args={[1.94, 0.44, 0.08]} />
          <meshStandardMaterial color="#c7ccd1" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      {/* Belt stripe. The 1964 livery wears a much deeper one, right under the windows. */}
      <mesh position={[0, livery === "shinkansen" ? 0.98 : 0.75, 0.6]}>
        <boxGeometry args={[1.87, livery === "shinkansen" ? 0.34 : 0.16, 6.02]} />
        <meshStandardMaterial color={paint.stripe} metalness={0.5} roughness={0.25} />
      </mesh>
      {/* Skirt hiding undercarriage */}
      <mesh position={[0, 0.35, 0.6]}>
        <boxGeometry args={[1.9, 0.42, 6.4]} />
        <meshStandardMaterial color="#3a4046" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Coupler cover */}
      <mesh position={[0, 0.7, noseTip + 0.1]}>
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
        color={paint.body}
        roofColor={paint.stripe}
        windowColor={paint.windowGlow}
        metalness={0.5}
        roughness={0.2}
        speed={speed}
      />
      <Carriage
        position={[0, 0, 11.8]}
        length={4}
        width={1.85}
        height={2.1}
        color={paint.body}
        roofColor={paint.stripe}
        windowColor={paint.windowGlow}
        metalness={0.5}
        roughness={0.2}
        speed={speed}
      />
    </group>
      }
    />
  );
}
