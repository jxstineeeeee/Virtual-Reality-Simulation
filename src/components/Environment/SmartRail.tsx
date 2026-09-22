import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { createTextTexture } from "../../materials/proceduralTextures";

/**
 * A line of automatic ticket gates: glass paddles, a lit arrow over each lane, and one wide lane
 * with a blue accessibility marking. The paddles cycle open and shut as people pass, which is the
 * only part of a modern station that is visibly *doing* anything from a distance.
 */
export function TicketGates({ position = [0, 0, 0], lanes = 3 }: { position?: [number, number, number]; lanes?: number }) {
  const paddleRefs = useRef<(THREE.Group | null)[]>([]);

  // Both indicators are the same open-lane arrow; the wide lane is marked out by colour and by the
  // painted floor stripe below it. Deliberately not the wheelchair pictogram — that glyph is not in
  // every platform's font, and a lane indicator that renders as an empty box is worse than no icon.
  const arrowMap = useMemo(
    () => createTextTexture({ text: "▲", width: 128, height: 128, background: "#07110c", color: "#4fe08a", scale: 0.7 }),
    [],
  );
  const wideMap = useMemo(
    () => createTextTexture({ text: "▲", width: 128, height: 128, background: "#071018", color: "#5ab7f0", scale: 0.7 }),
    [],
  );

  useFrame(() => {
    const t = timelineStore.getElapsed();
    for (let i = 0; i < paddleRefs.current.length; i++) {
      const paddle = paddleRefs.current[i];
      if (!paddle) continue;
      // Each lane on its own rhythm, so the row never opens and shuts in unison.
      const cycle = (t * 0.55 + i * 0.73) % 1;
      const open = cycle < 0.42 ? Math.min(cycle / 0.12, 1) * Math.min((0.42 - cycle) / 0.1, 1) : 0;
      paddle.rotation.y = -Math.max(open, 0) * 1.5;
    }
  });

  // The wide accessible lane is the last one, so the row reads left-to-right as narrow, narrow, wide.
  const laneWidth = (i: number) => (i === lanes ? 1.05 : 0.62);
  const lanePositions = useMemo(() => {
    const out: { x: number; width: number }[] = [];
    let x = 0;
    for (let i = 0; i <= lanes; i++) {
      const w = laneWidth(i);
      out.push({ x: x + w / 2, width: w });
      x += w + 0.26;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes]);

  const totalWidth = lanePositions.length ? lanePositions[lanePositions.length - 1].x + laneWidth(lanes) / 2 : 0;

  return (
    <group position={position}>
      {/* Gate pedestals between the lanes */}
      {lanePositions.map((lane, i) => (
        <group key={i}>
          {[lane.x - lane.width / 2 - 0.13, lane.x + lane.width / 2 + 0.13].map((x, side) => (
            <mesh key={side} position={[x, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.26, 1.0, 1.5]} />
              <meshStandardMaterial color="#d9dee3" metalness={0.35} roughness={0.35} />
            </mesh>
          ))}
          {/* Glass paddle, hinged on the near pedestal */}
          <group ref={(el) => (paddleRefs.current[i] = el)} position={[lane.x - lane.width / 2, 0.52, 0.2]}>
            <mesh position={[lane.width / 2, 0, 0]}>
              <boxGeometry args={[lane.width, 0.86, 0.03]} />
              <meshPhysicalMaterial color="#cfe6f2" transmission={0.86} thickness={0.03} ior={1.5} roughness={0.06} metalness={0} />
            </mesh>
          </group>
          {/* Lane indicator overhead */}
          <mesh position={[lane.x, 1.28, -0.4]} rotation={[-0.35, 0, 0]}>
            <planeGeometry args={[0.3, 0.3]} />
            <meshStandardMaterial map={i === lanes ? wideMap : arrowMap} emissiveMap={i === lanes ? wideMap : arrowMap} emissive="#ffffff" emissiveIntensity={0.9} toneMapped={false} />
          </mesh>
          {/* Blue floor marking through the wide lane — what actually tells you it is the step-free one */}
          {i === lanes && (
            <mesh position={[lane.x, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[lane.width * 0.8, 1.9]} />
              <meshStandardMaterial color="#1d5f8f" roughness={0.8} />
            </mesh>
          )}
          {/* Validator target on the pedestal top */}
          <mesh position={[lane.x - lane.width / 2 - 0.13, 1.01, 0.42]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 16]} />
            <meshStandardMaterial color="#1a2e3c" emissive="#3aa0e0" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Header beam over the whole gateline */}
      <mesh position={[totalWidth / 2, 1.62, -0.4]} castShadow>
        <boxGeometry args={[totalWidth + 0.4, 0.14, 0.5]} />
        <meshStandardMaterial color="#aab2ba" metalness={0.45} roughness={0.4} />
      </mesh>
    </group>
  );
}

/**
 * A free-standing departure board. `lines` is drawn once into a canvas, so the board carries real
 * words rather than the blank lit rectangle a geometry-only sign would be.
 */
export function DepartureBoard({
  position = [0, 0, 0],
  yaw = 0,
  title,
  subtitle,
  width = 2.4,
  background = "#07121c",
  color = "#eaf4ff",
}: {
  position?: [number, number, number];
  yaw?: number;
  title: string;
  subtitle?: string;
  width?: number;
  background?: string;
  color?: string;
}) {
  const map = useMemo(
    () => createTextTexture({ text: title, subText: subtitle, width: 640, height: 200, background, color, border: "#2a3f52" }),
    [title, subtitle, background, color],
  );
  const height = width * (200 / 640);

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2.3, 8]} />
        <meshStandardMaterial color="#8d939a" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position={[0, 2.35, 0]} castShadow>
        <boxGeometry args={[width + 0.1, height + 0.1, 0.08]} />
        <meshStandardMaterial color="#1b2530" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.35, 0.045]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={map} emissiveMap={map} emissive="#ffffff" emissiveIntensity={0.75} toneMapped={false} />
      </mesh>
    </group>
  );
}
