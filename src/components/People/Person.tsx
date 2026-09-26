import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { clamp01, lerp } from "../../timeline/timeline";
import type { HairStyle, HatKind, Outfit } from "./npcStyle";

export type NpcPose = "stand" | "sit";
export type NpcActivity = "idle" | "phone" | "newspaper" | "wave" | "holdPole" | "chat" | "lookWindow" | "shovel";

/** Written every frame by whatever moves a walking NPC; `walk` blends 0 (idle) .. 1 (full stride). */
export interface NpcMotion {
  walk: number;
  /** Gait cycle angle (radians), advanced from distance traveled so feet don't skate. */
  stride: number;
  /** 0 standing .. 1 seated. Blended, not switched, so a waiting passenger can rise in one motion. */
  sit?: number;
}

// Reference skeleton (meters, origin at the feet, facing +Z), before `outfit.height` scaling.
const HIP_Y = 0.9;
const SEAT_HIP_Y = 0.56;
const THIGH = 0.43;
/** Thigh pitch when seated: slightly below horizontal so the shins reach the floor from bench height. */
const SIT_THIGH = -1.36;
/** Radians/sec of the shovelling cycle — one dig-and-throw every ~3.3s, the pace of a long shift. */
const SHOVEL_RATE = 1.9;

/**
 * One leg's gait cycle, as smooth periodic functions of its own phase (radians):
 *   0 = mid-swing   π/2 = heel strike   π = mid-stance   3π/2 = toe-off
 * Everything here is built from cosines so it is continuous in value *and* slope across the cycle —
 * the old `max(0, cos)` knee kinked twice per step, which is what read as a mechanical shuffle.
 */
function thighSwing(p: number): number {
  return -Math.sin(p) * 0.46 - 0.04;
}

/**
 * Two flexions per cycle: the big one through swing, and a small one absorbing the heel strike. The
 * second is a broad give across the whole early stance rather than the narrow spike it was — at a
 * walking cadence a twelfth power is barely a tenth of a second wide, and the knee popped through it.
 */
function kneeFlex(p: number): number {
  const swing = Math.pow((1 + Math.cos(p + 0.35)) / 2, 3);
  const load = Math.pow((1 + Math.cos(p - 2.15)) / 2, 6);
  return 0.07 + swing + load * 0.2;
}

/**
 * The ankle is what stops a walk looking like stilts: the sole stays flat while the foot is planted
 * (so it cancels the shin's pitch), the toe lifts clear through swing, and the heel rolls up to push
 * off. `thigh`/`knee` are the already-blended joint angles this foot hangs off.
 */
function ankleFlex(p: number, thigh: number, knee: number): number {
  const planted = Math.pow((1 - Math.cos(p)) / 2, 1.4);
  const pushOff = Math.pow((1 + Math.cos(p - 4.75)) / 2, 8) * 0.85;
  return -(thigh + knee) * planted - 0.22 * (1 - planted) + pushOff;
}

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
  const ankles = useRef<(THREE.Group | null)[]>([]);
  const shoulders = useRef<(THREE.Group | null)[]>([]);
  const elbows = useRef<(THREE.Group | null)[]>([]);
  const standDrape = useRef<THREE.Group>(null);
  const sitDrape = useRef<THREE.Group>(null);
  const pack = useRef<THREE.Mesh>(null);
  const paper = useRef<THREE.Mesh>(null);
  const luggage = useRef<THREE.Group>(null);

  const seated = pose === "sit";
  /** A figure driven by `motionRef` can change pose mid-shot, so it carries both wardrobes at once. */
  const mobile = !!motionRef;
  const female = outfit.body === "f";
  const carrying = (!seated || mobile) && (outfit.carry === "suitcase" || outfit.carry === "briefcase") && activity !== "wave" && activity !== "phone";

  useFrame(() => {
    const t = timelineStore.getElapsed() + phase;
    const walk = motionRef?.current.walk ?? 0;
    const stride = motionRef?.current.stride ?? 0;
    const sit = clamp01(motionRef?.current.sit ?? (seated ? 1 : 0));
    const upright = 1 - sit;
    const holding = carrying && sit < 0.5;

    // The pelvis rises twice per stride (once over each stance leg), shifts across onto whichever
    // leg is carrying, and rotates with the swinging one — the three things that turn a leg animation
    // into a walk.
    const bob = (0.018 + Math.cos(stride * 2) * 0.018) * walk;
    if (hips.current) {
      hips.current.position.y = lerp(HIP_Y - 0.012 * (1 - walk) + bob, SEAT_HIP_Y, sit);
      hips.current.position.x = -Math.cos(stride) * 0.022 * walk * upright;
      const sway = Math.sin(t * 0.33) * 0.02 * (1 - walk) - Math.sin(stride) * 0.03 * walk;
      hips.current.rotation.set(0, -Math.sin(stride) * 0.05 * walk * upright, sway * upright);
    }

    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      const thigh = thighs.current[i];
      const knee = knees.current[i];
      const ankle = ankles.current[i];
      if (!thigh || !knee) continue;
      const legPhase = stride + (s > 0 ? 0 : Math.PI);
      const hipAngle = lerp(thighSwing(legPhase) * walk, SIT_THIGH, sit);
      const kneeAngle = lerp(lerp(0.03, kneeFlex(legPhase), walk), -SIT_THIGH + s * 0.05, sit);
      thigh.rotation.set(hipAngle, lerp(0, s * 0.07, sit), 0);
      knee.rotation.x = kneeAngle;
      if (ankle) ankle.rotation.x = lerp(ankleFlex(legPhase, hipAngle, kneeAngle) * walk, 0.12, sit);
    }

    if (spine.current) {
      spine.current.scale.y = 1 + Math.sin(t * 1.7) * 0.008;
      // A walker's head travels far less than their pelvis: the lumbar spine absorbs a good part of
      // the bob on the way up. Without that the whole figure pogos, which is the other half of what
      // reads as a mechanical walk.
      spine.current.position.y = 0.08 - bob * 0.45;
      if (activity === "shovel" && sit < 0.5) {
        // The whole body does the work, not just the arms: a deep bend into the heap, a twist to throw.
        spine.current.rotation.set(0.46 + Math.sin(t * SHOVEL_RATE) * 0.2, Math.sin(t * SHOVEL_RATE - 0.5) * 0.3, 0);
      } else {
        const lean = activity === "newspaper" || activity === "phone" ? 0.02 : -0.1;
        // The chest counter-rotates against the pelvis, which is what the arm swing is really hanging off.
        spine.current.rotation.set(
          lerp(0.05 * walk, lean, sit),
          lerp(Math.sin(stride) * 0.07 * walk, 0, sit),
          lerp(-Math.sin(t * 0.33) * 0.015 * (1 - walk), Math.sin(t * 1.1) * 0.012, sit),
        );
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
      const armPhase = stride + (right ? 0 : Math.PI);

      // Seated arm, and whatever the seated activity does with it.
      let seatSx = -0.3;
      let seatSz = s * 0.04;
      let seatEx = -1.0;
      const seatEz = 0;
      if (activity === "newspaper") {
        seatSx = -0.6;
        seatSz = -s * 0.14;
        seatEx = -1.45;
      } else if (activity === "phone" && right) {
        seatSx = -0.35;
        seatSz = -0.12;
        seatEx = -2.0;
      }

      // Standing/walking arm: swings opposite its own leg, and the elbow folds into the forward swing
      // instead of staying locked at one angle the whole way round.
      let sx = Math.sin(armPhase) * 0.42 * walk;
      let sz = s * (0.08 + 0.03 * walk);
      let ex = -0.12 - walk * (0.3 - Math.sin(armPhase) * 0.26);
      let ez = 0;

      if (activity === "phone" && right) {
        sx = -0.35;
        sz = -0.12;
        ex = -2.0;
      } else if (activity === "wave" && right) {
        sx = -0.2;
        sz = 2.6;
        ex = 0;
        ez = 0.35 + Math.sin(t * 7) * 0.45;
      } else if (activity === "holdPole" && right) {
        sx = -2.4;
        sz = 0;
        ex = -0.15;
      } else if (activity === "shovel") {
        // Both hands on the shaft: the lead hand low and forward, the other back by the hip.
        const swing = Math.sin(t * SHOVEL_RATE);
        sx = (right ? -1.15 : -0.85) + swing * 0.5;
        sz = s * 0.26;
        ex = (right ? -0.45 : -0.95) - Math.max(swing, 0) * 0.45;
      } else if (activity === "chat" && right) {
        sx = -0.25 + Math.sin(t * 1.3) * 0.1;
        ex = -1.2 + Math.sin(t * 1.7) * 0.25;
      } else if (holding && right) {
        sx *= 0.2;
        sz = 0.14;
        ex = 0;
      }

      shoulder.rotation.set(lerp(sx, seatSx, sit), 0, lerp(sz, seatSz, sit));
      elbow.rotation.set(lerp(ex, seatEx, sit), 0, lerp(ez, seatEz, sit));
    }

    // Wardrobe that only makes sense in one pose. A figure that never changes pose renders only its
    // own half of this, so these are all no-ops for the seated cabin and the standing platform.
    if (standDrape.current) standDrape.current.visible = sit < 0.5;
    if (sitDrape.current) sitDrape.current.visible = sit >= 0.5;
    if (pack.current) pack.current.visible = sit < 0.5;
    if (paper.current) paper.current.visible = sit >= 0.5;
    if (luggage.current) luggage.current.visible = holding;
  });

  const torsoWidth = female ? 1.02 : 1.15;
  const skin = cloth(outfit.skin, 0.6);

  return (
    // Seated figures never scale below reference size: the cabin's tall headrests (top at 1.32m) would
    // otherwise hide shorter passengers completely from the seated first-person camera.
    <group position={position} rotation={[0, yaw, 0]} scale={seated && !mobile ? Math.max(outfit.height, 1.02) : outfit.height}>
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
              <group ref={(el) => (ankles.current[i] = el)} position={[0, -0.4, 0]}>
                <mesh position={[0, -0.035, 0.05]} castShadow>
                  <boxGeometry args={[0.1, 0.07, 0.25]} />
                  {cloth(outfit.shoes, 0.5)}
                </mesh>
              </group>
            </group>
          </group>
        ))}

        {/* Skirt / coat hem hanging from the waist while upright; folded over the lap when seated */}
        {(!seated || mobile) && (outfit.skirt !== "none" || outfit.longCoat) && (
          <group ref={standDrape}>
            {outfit.skirt !== "none" && (
              <mesh position={[0, outfit.skirt === "long" ? -0.36 : -0.22, 0]} castShadow>
                <cylinderGeometry args={[0.17, outfit.skirt === "long" ? 0.33 : 0.25, outfit.skirt === "long" ? 0.86 : 0.55, 16, 1, true]} />
                <meshStandardMaterial color={outfit.bottom} roughness={0.9} side={2} />
              </mesh>
            )}
            {outfit.longCoat && (
              <mesh position={[0, -0.2, 0]} scale={[1, 1, 0.8]} castShadow>
                <cylinderGeometry args={[0.19, 0.215, 0.48, 16, 1, true]} />
                <meshStandardMaterial color={outfit.top} roughness={0.9} side={2} />
              </mesh>
            )}
          </group>
        )}
        {seated && (outfit.skirt !== "none" || outfit.longCoat) && (
          <group ref={sitDrape}>
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

          {outfit.carry === "backpack" && (!seated || mobile) && (
            <mesh ref={pack} position={[0, 0.3, -0.17]} castShadow>
              <boxGeometry args={[0.3, 0.38, 0.14]} />
              {cloth(outfit.accent === "#f2f2f2" ? "#2a2a30" : outfit.accent, 0.75)}
            </mesh>
          )}
          {activity === "newspaper" && seated && (
            <mesh ref={paper} position={[0, 0.3, 0.36]} rotation={[-0.35, 0, 0]}>
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
                  <group ref={luggage} position={[0, -0.47, 0]}>
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
