import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";

/** Stride length (metres) of a draught horse at a walk — what the gait cycle is measured against. */
const STRIDE_LENGTH = 1.7;
/** Shoulder height of the reference animal, before `scale`. */
const WITHERS_Y = 1.55;

interface HorseProps {
  /** Metres travelled. The gait is driven from distance, not time, so the hooves never skate. */
  distanceRef?: React.MutableRefObject<number>;
  /** 0 standing .. 1 walking; blends the leg swing and the head nod in and out. */
  walkRef?: React.MutableRefObject<number>;
  position?: [number, number, number];
  yaw?: number;
  scale?: number;
  /** Draw the collar, hames and trace chains of a wagon harness. */
  harness?: boolean;
}

const HIDE = "#4a3527";
const HIDE_DARK = "#3a2820";
const MANE = "#241a12";

function Leg({
  groupRef,
  kneeRef,
  x,
  z,
  front,
}: {
  groupRef: (el: THREE.Group | null) => void;
  kneeRef: (el: THREE.Group | null) => void;
  x: number;
  z: number;
  front: boolean;
}) {
  const upper = front ? 0.6 : 0.66;
  return (
    <group ref={groupRef} position={[x, WITHERS_Y - (front ? 0.36 : 0.44), z]}>
      <mesh position={[0, -upper / 2, 0]} castShadow>
        <capsuleGeometry args={[front ? 0.085 : 0.1, upper - 0.1, 4, 8]} />
        <meshStandardMaterial color={HIDE} roughness={0.9} />
      </mesh>
      <group ref={kneeRef} position={[0, -upper, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.42, 4, 8]} />
          <meshStandardMaterial color={HIDE_DARK} roughness={0.9} />
        </mesh>
        {/* Feathering and hoof */}
        <mesh position={[0, -0.52, 0]}>
          <capsuleGeometry args={[0.075, 0.08, 4, 8]} />
          <meshStandardMaterial color="#6b5544" roughness={0.95} />
        </mesh>
        <mesh position={[0, -0.6, 0.015]} castShadow>
          <cylinderGeometry args={[0.075, 0.085, 0.1, 10]} />
          <meshStandardMaterial color="#25201b" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * A procedural draught horse in the same stylized register as `Person`: jointed legs, neck and tail
 * animated from the shared timeline clock, with the gait driven by distance travelled so it stays
 * locked to whatever it is pulling. Built for the pit-head waggonway, where the horse *is* the engine.
 */
export function Horse({ distanceRef, walkRef, position, yaw = 0, scale = 1, harness = false }: HorseProps) {
  const legs = useRef<(THREE.Group | null)[]>([]);
  const knees = useRef<(THREE.Group | null)[]>([]);
  const neck = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = timelineStore.getElapsed();
    const distance = distanceRef?.current ?? 0;
    const walk = walkRef?.current ?? 0;
    const stride = (distance / STRIDE_LENGTH) * Math.PI * 2;

    // A walk is a four-beat gait: each leg lands a quarter-cycle after the one before it, in the
    // order near-hind, near-fore, off-hind, off-fore — which is what stops it reading as a pantomime.
    const PHASE = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5];
    for (let i = 0; i < 4; i++) {
      const leg = legs.current[i];
      const knee = knees.current[i];
      if (!leg || !knee) continue;
      const p = stride + PHASE[i];
      leg.rotation.x = -Math.sin(p) * 0.42 * walk;
      knee.rotation.x = Math.max(0, Math.cos(p)) * 0.5 * walk + 0.04;
    }

    if (body.current) {
      body.current.position.y = Math.abs(Math.cos(stride)) * 0.03 * walk;
      body.current.rotation.z = Math.sin(stride) * 0.015 * walk;
    }
    if (neck.current) {
      // The head nods with the stride when walking, and grazes/glances around when standing.
      neck.current.rotation.x = -0.62 + Math.sin(stride) * 0.09 * walk + Math.sin(t * 0.6) * 0.04 * (1 - walk);
      neck.current.rotation.y = Math.sin(t * 0.41) * 0.14 * (1 - walk);
    }
    if (tail.current) tail.current.rotation.z = Math.sin(t * 1.3) * 0.18;
  });

  return (
    <group position={position} rotation={[0, yaw, 0]} scale={scale}>
      <group ref={body}>
        {/* Barrel */}
        <mesh position={[0, WITHERS_Y - 0.18, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.88]} castShadow receiveShadow>
          <capsuleGeometry args={[0.42, 1.06, 6, 14]} />
          <meshStandardMaterial color={HIDE} roughness={0.88} />
        </mesh>
        {/* Hindquarters */}
        <mesh position={[0, WITHERS_Y - 0.14, -0.72] } castShadow>
          <sphereGeometry args={[0.44, 14, 12]} />
          <meshStandardMaterial color={HIDE} roughness={0.88} />
        </mesh>
        {/* Withers/shoulder */}
        <mesh position={[0, WITHERS_Y - 0.05, 0.6]} scale={[0.92, 1, 0.8]} castShadow>
          <sphereGeometry args={[0.4, 14, 12]} />
          <meshStandardMaterial color={HIDE} roughness={0.88} />
        </mesh>

        <group ref={neck} position={[0, WITHERS_Y + 0.08, 0.76]}>
          <mesh position={[0, 0.34, 0.1]} rotation={[0.35, 0, 0]} castShadow>
            <capsuleGeometry args={[0.16, 0.56, 5, 12]} />
            <meshStandardMaterial color={HIDE} roughness={0.88} />
          </mesh>
          {/* Mane along the crest */}
          <mesh position={[0, 0.46, -0.04]} rotation={[0.35, 0, 0]} castShadow>
            <boxGeometry args={[0.07, 0.62, 0.14]} />
            <meshStandardMaterial color={MANE} roughness={0.95} />
          </mesh>
          <group position={[0, 0.66, 0.34]} rotation={[0.55, 0, 0]}>
            <mesh castShadow>
              <capsuleGeometry args={[0.12, 0.26, 5, 12]} />
              <meshStandardMaterial color={HIDE} roughness={0.88} />
            </mesh>
            <mesh position={[0, -0.2, 0.02]} rotation={[0.2, 0, 0]} castShadow>
              <capsuleGeometry args={[0.085, 0.2, 5, 10]} />
              <meshStandardMaterial color={HIDE_DARK} roughness={0.88} />
            </mesh>
            {/* Blaze, eyes, ears */}
            <mesh position={[0, -0.24, 0.09]}>
              <boxGeometry args={[0.07, 0.24, 0.02]} />
              <meshStandardMaterial color="#d8cbb8" roughness={0.9} />
            </mesh>
            {([-1, 1] as const).map((s) => (
              <mesh key={s} position={[s * 0.095, 0.02, 0.06]}>
                <sphereGeometry args={[0.022, 8, 6]} />
                <meshStandardMaterial color="#15100c" roughness={0.25} />
              </mesh>
            ))}
            {([-1, 1] as const).map((s) => (
              <mesh key={s} position={[s * 0.075, 0.17, -0.03]} rotation={[-0.25, 0, s * 0.22]} castShadow>
                <coneGeometry args={[0.04, 0.14, 6]} />
                <meshStandardMaterial color={HIDE_DARK} roughness={0.9} />
              </mesh>
            ))}
            {harness && (
              <>
                {/* Bridle and blinkers */}
                <mesh position={[0, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <torusGeometry args={[0.1, 0.012, 5, 12]} />
                  <meshStandardMaterial color="#2a1d14" roughness={0.8} />
                </mesh>
                {([-1, 1] as const).map((s) => (
                  <mesh key={s} position={[s * 0.115, -0.02, 0.02]} rotation={[0, s * 0.3, 0]}>
                    <boxGeometry args={[0.02, 0.11, 0.1]} />
                    <meshStandardMaterial color="#2a1d14" roughness={0.8} />
                  </mesh>
                ))}
              </>
            )}
          </group>
        </group>

        <group ref={tail} position={[0, WITHERS_Y + 0.06, -1.06]}>
          <mesh position={[0, -0.3, -0.06]} rotation={[-0.3, 0, 0]} castShadow>
            <capsuleGeometry args={[0.07, 0.5, 5, 10]} />
            <meshStandardMaterial color={MANE} roughness={0.95} />
          </mesh>
        </group>

        {harness && (
          <group>
            {/* Collar and hames over the shoulder — what a draught horse actually pulls against */}
            <mesh position={[0, WITHERS_Y + 0.06, 0.74]} rotation={[0.35, 0, 0]}>
              <torusGeometry args={[0.28, 0.062, 8, 18]} />
              <meshStandardMaterial color="#3a2a1c" roughness={0.85} />
            </mesh>
            <mesh position={[0, WITHERS_Y + 0.02, 0.5]}>
              <boxGeometry args={[0.5, 0.12, 0.26]} />
              <meshStandardMaterial color="#2f2418" roughness={0.9} />
            </mesh>
            {/* Trace chains running back along the flanks toward the load */}
            {([-1, 1] as const).map((s) => (
              <mesh key={s} position={[s * 0.36, WITHERS_Y - 0.14, -0.35]} rotation={[0.04, 0, 0]}>
                <cylinderGeometry args={[0.018, 0.018, 2.1, 6]} />
                <meshStandardMaterial color="#3d352c" metalness={0.75} roughness={0.5} />
              </mesh>
            ))}
            {/* Belly band */}
            <mesh position={[0, WITHERS_Y - 0.2, 0.05]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.42, 0.028, 6, 16]} />
              <meshStandardMaterial color="#2f2418" roughness={0.9} />
            </mesh>
          </group>
        )}
      </group>

      {/* Fore and hind legs, near and off side */}
      {([
        [-0.26, -0.62, false],
        [0.26, -0.62, false],
        [-0.26, 0.6, true],
        [0.26, 0.6, true],
      ] as const).map(([x, z, front], i) => (
        <Leg
          key={`${x}${z}`}
          groupRef={(el) => (legs.current[i] = el)}
          kneeRef={(el) => (knees.current[i] = el)}
          x={x}
          z={z}
          front={front}
        />
      ))}
    </group>
  );
}
