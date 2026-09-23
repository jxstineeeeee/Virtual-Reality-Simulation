import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { panelAoTexture, panelNormalTexture, panelRoughnessTexture } from "../../materials/presets";
import { useDetailMap } from "../../materials/useDetailMap";

/** Beading and rivets stand a few millimetres proud of the paint — no more than that. */
const PANEL_RELIEF = new THREE.Vector2(0.6, 0.6);

interface WheelProps {
  position: [number, number, number];
  radius?: number;
  width?: number;
  speed: number;
  color?: string;
  metalness?: number;
  roughness?: number;
  spoked?: boolean;
}

/** A single rolling wheel: a short cylinder spinning around its local X axis, with an optional hub detail. */
export function Wheel({
  position,
  radius = 0.45,
  width = 0.22,
  speed,
  color = "#1a1a1a",
  metalness = 0.6,
  roughness = 0.5,
  spoked = false,
}: WheelProps) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x += speed * 2.2 * delta;
    }
  });
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 2]} ref={ref} castShadow>
        <cylinderGeometry args={[radius, radius, width, 24]} />
        <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
      </mesh>
      {spoked && (
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[radius * 0.32, radius * 0.32, width + 0.03, 16]} />
          <meshStandardMaterial color="#c9a86a" metalness={0.85} roughness={0.3} />
        </mesh>
      )}
    </group>
  );
}

interface ConnectingRodProps {
  /** Local-space Z of the rear and front driving-wheel centers this rod links. */
  z1: number;
  z2: number;
  wheelY: number;
  radius: number;
  speed: number;
  xOffset: number;
}

/** Animated side rod + crank pins linking two driving wheels, synchronized to the same rotation as the wheels. */
export function ConnectingRod({ z1, z2, wheelY, radius, speed, xOffset }: ConnectingRodProps) {
  const rodRef = useRef<THREE.Mesh>(null);
  const crank1Ref = useRef<THREE.Mesh>(null);
  const crank2Ref = useRef<THREE.Mesh>(null);
  const angleRef = useRef(0);
  const p1 = useRef(new THREE.Vector3());
  const p2 = useRef(new THREE.Vector3());
  const mid = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    angleRef.current += speed * 2.2 * delta;
    const cosA = Math.cos(angleRef.current);
    const sinA = Math.sin(angleRef.current);
    const y = wheelY + radius * cosA;
    const zOff = radius * sinA;

    p1.current.set(xOffset, y, z1 + zOff);
    p2.current.set(xOffset, y, z2 + zOff);
    mid.current.copy(p1.current).add(p2.current).multiplyScalar(0.5);

    crank1Ref.current?.position.copy(p1.current);
    crank2Ref.current?.position.copy(p2.current);

    if (rodRef.current) {
      rodRef.current.position.copy(mid.current);
      rodRef.current.scale.z = Math.max(p1.current.distanceTo(p2.current), 0.01);
      rodRef.current.lookAt(p2.current);
    }
  });

  return (
    <group>
      <mesh ref={crank1Ref} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.12, 8]} />
        <meshStandardMaterial color="#d4b483" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh ref={crank2Ref} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.12, 8]} />
        <meshStandardMaterial color="#d4b483" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh ref={rodRef} castShadow>
        <boxGeometry args={[0.07, 0.07, 1]} />
        <meshStandardMaterial color="#c9a86a" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

interface CarriageProps {
  position: [number, number, number];
  length?: number;
  width?: number;
  height?: number;
  color: string;
  roofColor?: string;
  windowColor?: string;
  metalness?: number;
  roughness?: number;
  litWindows?: boolean;
  /** Wheel rotation speed — should match the locomotive's speed so the whole train rolls in sync. */
  speed?: number;
}

/** A boxy passenger/cargo carriage with a glazed window band and a roof strip. */
export function Carriage({
  position,
  length = 3.4,
  width = 1.7,
  height = 2.3,
  color,
  roofColor,
  windowColor = "#bfe3f2",
  metalness = 0.3,
  roughness = 0.6,
  litWindows = true,
  speed = 0,
}: CarriageProps) {
  // Two tiles along the car and one up its side, which puts the beading courses at roughly the
  // spacing a real body has for a car of this length rather than at whatever the texture happens
  // to be. The ends get the same pattern squashed, which at this scale reads as end panelling.
  const panelNormal = useDetailMap(panelNormalTexture, 2, 1);
  const panelRough = useDetailMap(panelRoughnessTexture, 2, 1);
  const panelAo = useDetailMap(panelAoTexture, 2, 1);

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, length]} />
        <meshStandardMaterial
          color={color}
          normalMap={panelNormal}
          normalScale={PANEL_RELIEF}
          roughnessMap={panelRough}
          aoMap={panelAo}
          aoMapIntensity={0.55}
          metalness={metalness}
          roughness={roughness}
        />
      </mesh>
      {/* The window band is a shell wrapped around a solid body, so there is nothing behind it to
          see through — and transmission against an opaque box just tinted the paint, which is why
          this read as a stripe painted along the car rather than as glazing. From outside, in
          daylight, a train window is a mirror: dark glass returning the sky. So it is now a
          near-black, very smooth surface with the reflection probe doing the work, which is both
          what it actually looks like and cheaper than the transmission pass it replaces. */}
      <mesh position={[0, height * 0.62, 0]}>
        <boxGeometry args={[width + 0.03, height * 0.28, length * 0.86]} />
        <meshPhysicalMaterial
          color="#10171d"
          roughness={0.06}
          metalness={0.1}
          envMapIntensity={2.4}
          clearcoat={1}
          clearcoatRoughness={0.04}
          emissive={litWindows ? windowColor : "#000000"}
          emissiveIntensity={litWindows ? 0.35 : 0}
        />
      </mesh>
      <mesh position={[0, height + 0.06, 0]} castShadow>
        <boxGeometry args={[width + 0.06, 0.12, length + 0.1]} />
        <meshStandardMaterial color={roofColor ?? color} roughnessMap={panelRough} metalness={metalness} roughness={roughness} />
      </mesh>
      {/* Undercarriage skirt: catches shadow beneath the floor line so the car doesn't look hollow. */}
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[width - 0.04, 0.1, length - 0.1]} />
        <meshStandardMaterial color="#15161a" metalness={0.3} roughness={0.85} />
      </mesh>
      <Wheel position={[width / 2 + 0.02, 0.45, length / 2 - 0.6]} speed={speed} color="#111" />
      <Wheel position={[-width / 2 - 0.02, 0.45, length / 2 - 0.6]} speed={speed} color="#111" />
      <Wheel position={[width / 2 + 0.02, 0.45, -length / 2 + 0.6]} speed={speed} color="#111" />
      <Wheel position={[-width / 2 - 0.02, 0.45, -length / 2 + 0.6]} speed={speed} color="#111" />
    </group>
  );
}
