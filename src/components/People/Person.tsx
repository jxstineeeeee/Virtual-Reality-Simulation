import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import type { HairStyle, HatKind, Outfit } from "./npcStyle";

export type NpcPose = "stand" | "sit";
export type NpcActivity = "idle" | "phone" | "newspaper" | "wave" | "holdPole" | "chat" | "lookWindow" | "shovel";

/** Written every frame by whatever moves a walking NPC; `walk` blends 0 (idle) .. 1 (full stride). */
export interface NpcMotion {
  walk: number;
  /** Gait cycle angle (radians), advanced from distance traveled so feet don't skate. */
  stride: number;
}

// Reference skeleton (meters, origin at the feet, facing +Z), before `outfit.height` scaling.
const HIP_Y = 0.9;
const SEAT_HIP_Y = 0.56;
const THIGH = 0.43;
/** Thigh pitch when seated: slightly below horizontal so the shins reach the floor from bench height. */
const SIT_THIGH = -1.36;
/** Radians/sec of the shovelling cycle — one dig-and-throw every ~3.3s, the pace of a long shift. */
const SHOVEL_RATE = 1.9;

const cloth = (color: string, roughness = 0.9) => <meshStandardMaterial color={color} roughness={roughness} />;

function Hair({ style, color }: { style: HairStyle; color: string }) {
  if (style === "bald") return null;
  return (
    <group>
      <mesh position={[0, 0.035, -0.012]} scale={[1, 0.72, 1.02]}>
        <sphereGeometry args={[0.112, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        {cloth(color, 0.8)}
      </mesh>
      {style === "long" && (
        <mesh position={[0, -0.09, -0.07]}>
          <boxGeometry args={[0.2, 0.26, 0.06]} />
          {cloth(color, 0.8)}
        </mesh>
      )}
      {style === "bun" && (
        <mesh position={[0, 0.07, -0.1]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          {cloth(color, 0.8)}
        </mesh>
      )}
    </group>
  );
}

function Hat({ kind, color, accent }: { kind: HatKind; color: string; accent: string }) {
  const felt = cloth(color, 0.85);
  switch (kind) {
    case "topHat":
      return (
        <group position={[0, 0.07, 0]}>
          <mesh position={[0, 0.11, 0]} castShadow>
            <cylinderGeometry args={[0.095, 0.1, 0.2, 16]} />
            {felt}
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.165, 0.165, 0.012, 20]} />
            {felt}
          </mesh>
        </group>
      );
    case "bowler":
      return (
        <group position={[0, 0.06, 0]}>
          <mesh>
            <sphereGeometry args={[0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {felt}
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.15, 0.15, 0.01, 20]} />
            {felt}
          </mesh>
        </group>
      );
    case "fedora":
      return (
        <group position={[0, 0.07, 0]}>
          <mesh position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.1, 14]} />
            {felt}
          </mesh>
          <mesh position={[0, 0.012, 0]}>
            <cylinderGeometry args={[0.112, 0.112, 0.025, 14]} />
            {cloth(accent, 0.7)}
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.175, 0.175, 0.01, 20]} />
            {felt}
          </mesh>
        </group>
      );
    case "wideBrim":
      return (
        <group position={[0, 0.08, 0]} rotation={[-0.12, 0, 0]}>
          <mesh position={[0, 0.035, 0]}>
            <cylinderGeometry args={[0.085, 0.1, 0.07, 14]} />
            {felt}
          </mesh>
          <mesh position={[0, 0.012, 0]}>
            <cylinderGeometry args={[0.102, 0.102, 0.022, 14]} />
            {cloth(accent, 0.6)}
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.23, 0.23, 0.01, 24]} />
            {felt}
          </mesh>
        </group>
      );
    case "flatCap":
      return (
        <group position={[0, 0.05, 0]}>
          <mesh scale={[1, 0.45, 1.08]}>
            <sphereGeometry args={[0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {felt}
          </mesh>
          <mesh position={[0, 0.005, 0.12]} rotation={[0.15, 0, 0]}>
            <boxGeometry args={[0.16, 0.012, 0.07]} />
            {felt}
          </mesh>
        </group>
      );
    case "beanie":
      return (
        <mesh position={[0, 0.02, 0]} scale={[1, 1.1, 1]}>
          <sphereGeometry args={[0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          {felt}
        </mesh>
      );
    case "baseballCap":
      return (
        <group position={[0, 0.04, 0]}>
          <mesh>
            <sphereGeometry args={[0.118, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            {felt}
          </mesh>
          <mesh position={[0, 0.005, 0.13]}>
            <boxGeometry args={[0.15, 0.01, 0.09]} />
            {felt}
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

interface PersonProps {
  outfit: Outfit;
  pose?: NpcPose;
  activity?: NpcActivity;
  /** Seconds offset so a crowd doesn't breathe, glance, or sway in unison. */
  phase?: number;
  motionRef?: React.MutableRefObject<NpcMotion>;
  position?: [number, number, number];
  yaw?: number;
}

/**
 * A stylized, fully procedural human NPC (no GLB), matching the rest of the scene's procedural art:
 * jointed legs/arms/spine/head groups animated every frame from the shared timeline clock, so NPCs
 * freeze with the cinematic on pause. Handles standing idle (breathing, weight shift, glancing),
 * walking (driven by `motionRef`), and sitting on a cabin bench, plus a few small activities.
 */
export function Person({ outfit, pose = "stand", activity = "idle", phase = 0, motionRef, position, yaw = 0 }: PersonProps) {
  const hips = useRef<THREE.Group>(null);
  const spine = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const thighs = useRef<(THREE.Group | null)[]>([]);
  const knees = useRef<(THREE.Group | null)[]>([]);
  const shoulders = useRef<(THREE.Group | null)[]>([]);
  const elbows = useRef<(THREE.Group | null)[]>([]);

  const seated = pose === "sit";
  const female = outfit.body === "f";
  const carrying = !seated && (outfit.carry === "suitcase" || outfit.carry === "briefcase") && activity !== "wave" && activity !== "phone";

  useFrame(() => {
    const t = timelineStore.getElapsed() + phase;
    const walk = motionRef?.current.walk ?? 0;
    const stride = motionRef?.current.stride ?? 0;

    if (hips.current) {
      hips.current.position.y = seated ? SEAT_HIP_Y : HIP_Y - 0.012 * (1 - walk) + Math.abs(Math.cos(stride)) * 0.028 * walk;
      hips.current.rotation.z = seated ? 0 : Math.sin(t * 0.33) * 0.02 * (1 - walk);
    }

    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const thigh = thighs.current[i];
      const knee = knees.current[i];
      if (!thigh || !knee) continue;
      if (seated) {
        thigh.rotation.set(SIT_THIGH, s * 0.07, 0);
        knee.rotation.x = -SIT_THIGH + s * 0.05;
      } else {
        const legPhase = stride + (s > 0 ? 0 : Math.PI);
        thigh.rotation.set(-Math.sin(legPhase) * 0.48 * walk, 0, 0);
        knee.rotation.x = Math.max(0, Math.cos(legPhase)) * 0.75 * walk + 0.03;
      }
    }

    if (spine.current) {
      spine.current.scale.y = 1 + Math.sin(t * 1.7) * 0.008;
      if (seated) {
        const lean = activity === "newspaper" || activity === "phone" ? 0.02 : -0.1;
        spine.current.rotation.set(lean, 0, Math.sin(t * 1.1) * 0.012);
      } else if (activity === "shovel") {
        // The whole body does the work, not just the arms: a deep bend into the heap, a twist to throw.
        spine.current.rotation.set(0.46 + Math.sin(t * SHOVEL_RATE) * 0.2, Math.sin(t * SHOVEL_RATE - 0.5) * 0.3, 0);
      } else {
        spine.current.rotation.set(0.05 * walk, Math.sin(stride) * 0.08 * walk, -Math.sin(t * 0.33) * 0.015 * (1 - walk));
      }
    }

    if (head.current) {
      let yawHead = (Math.sin(t * 0.23) * 0.4 + Math.sin(t * 0.61) * 0.12) * (1 - walk * 0.6);
      let pitch = 0.02;
      if (activity === "lookWindow") yawHead = -0.85 + Math.sin(t * 0.2) * 0.15;
      else if (activity === "phone") {
        yawHead = Math.sin(t * 0.4) * 0.05;
        pitch = 0.45;
      } else if (activity === "newspaper") {
        yawHead = Math.sin(t * 0.5) * 0.12;
        pitch = 0.3;
      } else if (activity === "chat") {
        yawHead = Math.sin(t * 0.9) * 0.1;
        pitch = Math.sin(t * 2.3) * 0.05;
      } else if (activity === "holdPole") {
        pitch = 0.1;
      } else if (activity === "shovel") {
        // Eyes on the blade, not on the world.
        yawHead = Math.sin(t * SHOVEL_RATE - 0.5) * -0.2;
        pitch = 0.3;
      }
      head.current.rotation.set(pitch, yawHead, 0);
    }

    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const shoulder = shoulders.current[i];
      const elbow = elbows.current[i];
      if (!shoulder || !elbow) continue;
      const right = s > 0;
      let sx = 0;
      let sz = s * 0.08;
      let ex = -0.12;
      let ez = 0;

      if (seated) {
        sx = -0.3;
        sz = s * 0.04;
        ex = -1.0;
      } else {
        sx = Math.sin(stride + (s > 0 ? 0 : Math.PI)) * 0.4 * walk;
      }

      if (activity === "newspaper" && seated) {
        sx = -0.6;
        sz = -s * 0.14;
        ex = -1.45;
      } else if (activity === "phone" && right) {
        sx = -0.35;
        sz = -0.12;
        ex = -2.0;
      } else if (activity === "wave" && right && !seated) {
        sx = -0.2;
        sz = 2.6;
        ex = 0;
        ez = 0.35 + Math.sin(t * 7) * 0.45;
      } else if (activity === "holdPole" && right) {
        sx = -2.4;
        sz = 0;
        ex = -0.15;
      } else if (activity === "shovel" && !seated) {
        // Both hands on the shaft: the lead hand low and forward, the other back by the hip.
        const swing = Math.sin(t * SHOVEL_RATE);
        sx = (right ? -1.15 : -0.85) + swing * 0.5;
        sz = s * 0.26;
        ex = (right ? -0.45 : -0.95) - Math.max(swing, 0) * 0.45;
      } else if (activity === "chat" && right && !seated) {
        sx = -0.25 + Math.sin(t * 1.3) * 0.1;
        ex = -1.2 + Math.sin(t * 1.7) * 0.25;
      } else if (carrying && right) {
        sx *= 0.2;
        sz = 0.14;
        ex = 0;
      }

      shoulder.rotation.set(sx, 0, sz);
      elbow.rotation.set(ex, 0, ez);
    }
  });

  const torsoWidth = female ? 1.02 : 1.15;
  const skin = cloth(outfit.skin, 0.6);

  return (
    // Seated figures never scale below reference size: the cabin's tall headrests (top at 1.32m) would
    // otherwise hide shorter passengers completely from the seated first-person camera.
    <group position={position} rotation={[0, yaw, 0]} scale={seated ? Math.max(outfit.height, 1.02) : outfit.height}>
      <group ref={hips} position={[0, seated ? SEAT_HIP_Y : HIP_Y, 0]}>
        {/* Pelvis */}
        <mesh position={[0, 0.02, 0]} castShadow>
          <boxGeometry args={[female ? 0.3 : 0.32, 0.16, 0.2]} />
          {cloth(outfit.bottom)}
        </mesh>

        {[-1, 1].map((s, i) => (
          <group key={s} ref={(el) => (thighs.current[i] = el)} position={[s * 0.09, 0, 0]}>
            <mesh position={[0, -0.21, 0]} castShadow>
              <capsuleGeometry args={[0.07, 0.3, 4, 10]} />
              {cloth(outfit.bottom)}
            </mesh>
            <group ref={(el) => (knees.current[i] = el)} position={[0, -THIGH, 0]}>
              <mesh position={[0, -0.2, 0]} castShadow>
                <capsuleGeometry args={[0.058, 0.3, 4, 10]} />
                {outfit.skirt === "knee" && !seated ? skin : cloth(outfit.bottom)}
              </mesh>
              <mesh position={[0, -0.43, 0.05]} castShadow>
                <boxGeometry args={[0.1, 0.07, 0.25]} />
                {cloth(outfit.shoes, 0.5)}
              </mesh>
            </group>
          </group>
        ))}

        {/* Skirt / coat hem hanging from the waist while upright; folded over the lap when seated */}
        {!seated && outfit.skirt !== "none" && (
          <mesh position={[0, outfit.skirt === "long" ? -0.36 : -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.17, outfit.skirt === "long" ? 0.33 : 0.25, outfit.skirt === "long" ? 0.86 : 0.55, 16, 1, true]} />
            <meshStandardMaterial color={outfit.bottom} roughness={0.9} side={2} />
          </mesh>
        )}
        {!seated && outfit.longCoat && (
          <mesh position={[0, -0.2, 0]} scale={[1, 1, 0.8]} castShadow>
            <cylinderGeometry args={[0.19, 0.215, 0.48, 16, 1, true]} />
            <meshStandardMaterial color={outfit.top} roughness={0.9} side={2} />
          </mesh>
        )}
        {seated && (outfit.skirt !== "none" || outfit.longCoat) && (
          <group>
            <mesh position={[0, -0.02, 0.2]}>
              <boxGeometry args={[0.36, 0.1, 0.44]} />
              {cloth(outfit.skirt !== "none" ? outfit.bottom : outfit.top)}
            </mesh>
            {outfit.skirt === "long" && (
              <mesh position={[0, -0.26, 0.43]}>
                <boxGeometry args={[0.36, 0.5, 0.06]} />
                {cloth(outfit.bottom)}
              </mesh>
            )}
          </group>
        )}

        <group ref={spine} position={[0, 0.08, 0]}>
          {/* Torso */}
          <mesh position={[0, 0.3, 0]} scale={[torsoWidth, 1, 0.72]} castShadow>
            <capsuleGeometry args={[0.16, 0.28, 6, 14]} />
            {cloth(outfit.top)}
          </mesh>
          {/* Collar/scarf accent */}
          <mesh position={[0, 0.5, 0]} scale={[1, 0.5, 0.85]}>
            <torusGeometry args={[0.07, 0.025, 6, 14]} />
            {cloth(outfit.accent, 0.8)}
          </mesh>
          {/* Neck */}
          <mesh position={[0, 0.54, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.1, 10]} />
            {skin}
          </mesh>

          {outfit.carry === "backpack" && !seated && (
            <mesh position={[0, 0.3, -0.17]} castShadow>
              <boxGeometry args={[0.3, 0.38, 0.14]} />
              {cloth(outfit.accent === "#f2f2f2" ? "#2a2a30" : outfit.accent, 0.75)}
            </mesh>
          )}
          {activity === "newspaper" && seated && (
            <mesh position={[0, 0.3, 0.36]} rotation={[-0.35, 0, 0]}>
              <boxGeometry args={[0.52, 0.36, 0.01]} />
              <meshStandardMaterial color="#e6e0cf" roughness={0.95} />
            </mesh>
          )}

          <group ref={head} position={[0, 0.66, 0]}>
            <mesh scale={[0.92, 1.08, 1]} castShadow>
              <sphereGeometry args={[0.105, 16, 12]} />
              {skin}
            </mesh>
            <mesh position={[0, -0.01, 0.1]}>
              <sphereGeometry args={[0.018, 8, 6]} />
              {skin}
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.034, 0.02, 0.092]}>
                <sphereGeometry args={[0.011, 6, 6]} />
                <meshStandardMaterial color="#1a1410" roughness={0.3} />
              </mesh>
            ))}
            <Hair style={outfit.hat === "none" ? outfit.hairStyle : outfit.hairStyle === "long" ? "long" : "bald"} color={outfit.hair} />
            <Hat kind={outfit.hat} color={outfit.hatColor} accent={outfit.accent} />
            {outfit.headphones && (
              <group>
                <mesh position={[0, 0.02, 0]}>
                  <torusGeometry args={[0.115, 0.012, 6, 16, Math.PI]} />
                  <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
                </mesh>
                {[-1, 1].map((s) => (
                  <mesh key={s} position={[s * 0.105, 0.0, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
                    <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
                  </mesh>
                ))}
              </group>
            )}
          </group>

          {[-1, 1].map((s, i) => (
            <group key={s} ref={(el) => (shoulders.current[i] = el)} position={[s * (female ? 0.19 : 0.215), 0.46, 0]}>
              <mesh position={[0, -0.14, 0]} castShadow>
                <capsuleGeometry args={[0.05, 0.2, 4, 10]} />
                {cloth(outfit.top)}
              </mesh>
              <group ref={(el) => (elbows.current[i] = el)} position={[0, -0.29, 0]}>
                <mesh position={[0, -0.12, 0]} castShadow>
                  <capsuleGeometry args={[0.044, 0.18, 4, 10]} />
                  {cloth(outfit.top)}
                </mesh>
                <mesh position={[0, -0.27, 0]}>
                  <sphereGeometry args={[0.045, 10, 8]} />
                  {skin}
                </mesh>
                {s > 0 && activity === "shovel" && (
                  // Held in the lead hand, angled down at the heap the figure is bent over.
                  <group position={[0, -0.3, 0.02]} rotation={[0.95, 0, 0]}>
                    <mesh castShadow>
                      <cylinderGeometry args={[0.018, 0.02, 0.9, 6]} />
                      <meshStandardMaterial color="#6a5236" roughness={0.9} />
                    </mesh>
                    <mesh position={[0, -0.52, 0.02]} rotation={[0.12, 0, 0]} castShadow>
                      <boxGeometry args={[0.19, 0.25, 0.018]} />
                      <meshStandardMaterial color="#4a443c" metalness={0.75} roughness={0.45} />
                    </mesh>
                  </group>
                )}
                {s > 0 && activity === "phone" && (
                  <mesh position={[0, -0.3, 0.03]} rotation={[0.3, 0, 0]}>
                    <boxGeometry args={[0.07, 0.14, 0.012]} />
                    <meshStandardMaterial color="#111" emissive="#6fb6ff" emissiveIntensity={0.6} roughness={0.2} />
                  </mesh>
                )}
                {s > 0 && carrying && (
                  <group position={[0, -0.47, 0]}>
                    <mesh castShadow>
                      <boxGeometry args={outfit.carry === "suitcase" ? [0.14, 0.34, 0.46] : [0.1, 0.28, 0.38]} />
                      {cloth(outfit.carry === "suitcase" ? "#5a3a22" : "#2a1e16", 0.6)}
                    </mesh>
                    <mesh position={[0, 0.19, 0]}>
                      <boxGeometry args={[0.03, 0.04, 0.12]} />
                      <meshStandardMaterial color="#2a2a2a" roughness={0.5} />
                    </mesh>
                  </group>
                )}
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
