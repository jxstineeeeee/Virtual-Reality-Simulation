import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { panelRoughnessTexture } from "../../materials/presets";
import { useDetailMap } from "../../materials/useDetailMap";
import type { DoorSpec, DoorState } from "./trainDoors";

const HIGHLIGHT_COLOR = "#ffc93a";

interface BoardingDoorwayProps {
  spec: DoorSpec;
  stateRef: React.MutableRefObject<DoorState>;
  /** Which Z direction the opened leaf swings toward — pick the side the viewer is NOT walking in from. */
  swingToward: 1 | -1;
}

/** How far the leaf swings out from the carriage side when fully open (~100°). */
const OPEN_SWING = 1.75;

/**
 * A boardable passenger door mounted on the outside of a train's first carriage (train-local coords,
 * so it rides along inside the train's group/TrainCarrier). While `highlight` is up it pulses a
 * glowing outline, a floor marker, a bobbing arrow, and a spotlight so the viewer's eye goes straight
 * to it; `open` swings the hinged leaf outward to reveal the lit interior the camera then walks into.
 * Pulsing is done through emissive intensity/scale only — never opacity, which `TrainCarrier` owns.
 */
export function BoardingDoorway({ spec, stateRef, swingToward }: BoardingDoorwayProps) {
  const leafRef = useRef<THREE.Group>(null);
  const arrowRef = useRef<THREE.Group>(null);
  const markerRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const outlineRef = useRef<THREE.Group>(null);

  const outlineMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: HIGHLIGHT_COLOR, emissive: HIGHLIGHT_COLOR, emissiveIntensity: 0, toneMapped: false }),
    [],
  );
  const glowMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: spec.glow, emissive: spec.glow, emissiveIntensity: 0, toneMapped: false }),
    [spec.glow],
  );
  const markerMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: HIGHLIGHT_COLOR, emissive: HIGHLIGHT_COLOR, emissiveIntensity: 2, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }),
    [],
  );

  // The door leaf is held in close-up for the whole boarding beat, so flat paint on it is the
  // most-looked-at flat surface in the film. It gets the coachwork weathering — the rain runs and
  // hand-polish — but not the beading relief, which belongs on a body side and not on a door.
  const leafRough = useDetailMap(panelRoughnessTexture, 1, 1);

  const midY = spec.floorY + spec.height / 2;

  useFrame(() => {
    const { open, highlight } = stateRef.current;
    const t = timelineStore.getElapsed();
    const pulse = highlight * (0.6 + 0.4 * Math.sin(t * 5));

    // Hinged at the `swingToward` post; positive swing sends the free edge out toward -X (the platform).
    if (leafRef.current) leafRef.current.rotation.y = swingToward * open * OPEN_SWING;
    glowMat.emissiveIntensity = open * 1.0;

    outlineMat.emissiveIntensity = pulse * 3.2;
    if (outlineRef.current) outlineRef.current.visible = highlight > 0.01;

    if (markerRef.current) {
      markerRef.current.visible = highlight > 0.01;
      markerRef.current.scale.setScalar(0.85 + 0.25 * ((t * 0.9) % 1));
      markerMat.emissiveIntensity = pulse * 2.4;
    }
    if (arrowRef.current) {
      arrowRef.current.visible = highlight > 0.01;
      arrowRef.current.position.y = spec.floorY + spec.height + 0.5 + Math.sin(t * 3) * 0.09;
      arrowRef.current.rotation.y = t * 1.5;
    }
    if (lightRef.current) lightRef.current.intensity = pulse * 2.2 + open * 1.6;
  });

  const postZ = spec.width / 2 + 0.04;
  const outlineZ = spec.width / 2 + 0.11;

  return (
    <group position={[spec.x, 0, 0]}>
      {/* Lit interior revealed as the leaf swings away: a one-sided plane facing the platform, so a camera
          stepping off from inside the carriage looks straight out through it */}
      <mesh position={[-0.022, midY, spec.z]} rotation={[0, -Math.PI / 2, 0]} material={glowMat}>
        <planeGeometry args={[spec.width, spec.height]} />
      </mesh>

      {/* Hinged leaf with a small window and handle; the outer group is the hinge line */}
      <group ref={leafRef} position={[-0.045, midY, spec.z + (swingToward * spec.width) / 2]}>
        <group position={[0, 0, (-swingToward * spec.width) / 2]}>
          <mesh castShadow>
            <boxGeometry args={[0.035, spec.height - 0.02, spec.width]} />
            <meshStandardMaterial color={spec.leaf} roughnessMap={leafRough} metalness={0.35} roughness={0.5} />
          </mesh>
          <mesh position={[-0.02, spec.height * 0.2, 0]}>
            <boxGeometry args={[0.01, spec.height * 0.24, spec.width * 0.55]} />
            {/* Actual glass rather than a pale blue slab: the droplight is the one place the viewer
                can see into the carriage before boarding it, and an opaque pane there makes the
                train read as a prop. The emissive keeps it legible once the light goes. */}
            <meshPhysicalMaterial
              color="#b9d6e2"
              transmission={0.82}
              thickness={0.02}
              ior={1.5}
              emissive="#cfe6f0"
              emissiveIntensity={0.12}
              roughness={0.06}
              metalness={0}
              clearcoat={1}
              clearcoatRoughness={0.05}
            />
          </mesh>
          <mesh position={[-0.03, -0.05, -swingToward * spec.width * 0.36]}>
            <boxGeometry args={[0.03, 0.22, 0.03]} />
            <meshStandardMaterial color="#d8d2c0" metalness={0.8} roughness={0.25} />
          </mesh>
        </group>
      </group>

      {/* Frame: posts + lintel */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-0.035, midY + 0.02, spec.z + s * postZ]}>
          <boxGeometry args={[0.06, spec.height + 0.08, 0.06]} />
          <meshStandardMaterial color={spec.frame} metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[-0.035, spec.floorY + spec.height + 0.04, spec.z]}>
        <boxGeometry args={[0.06, 0.06, spec.width + 0.14]} />
        <meshStandardMaterial color={spec.frame} metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Grab handrails and boarding step */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-0.11, spec.floorY + 0.95, spec.z + s * (postZ + 0.06)]}>
          <cylinderGeometry args={[0.018, 0.018, 0.9, 8]} />
          <meshStandardMaterial color="#d8d2c0" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[-0.2, spec.floorY - 0.14, spec.z]} castShadow receiveShadow>
        <boxGeometry args={[0.32, 0.06, spec.width + 0.1]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.6} />
      </mesh>

      {/* Highlight: glowing outline around the doorway */}
      <group ref={outlineRef} visible={false}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[-0.075, midY, spec.z + s * outlineZ]} material={outlineMat}>
            <boxGeometry args={[0.03, spec.height + 0.26, 0.04]} />
          </mesh>
        ))}
        {[spec.floorY - 0.1, spec.floorY + spec.height + 0.13].map((y) => (
          <mesh key={y} position={[-0.075, y, spec.z]} material={outlineMat}>
            <boxGeometry args={[0.03, 0.04, spec.width + 0.26]} />
          </mesh>
        ))}
      </group>

      {/* Highlight: pulsing ring on the ground where the viewer should walk */}
      <mesh ref={markerRef} position={[-1.1, 0.02, spec.z]} rotation={[-Math.PI / 2, 0, 0]} material={markerMat} visible={false}>
        <ringGeometry args={[0.42, 0.52, 40]} />
      </mesh>

      {/* Highlight: bobbing arrow pointing down at the door */}
      <group ref={arrowRef} position={[-0.45, spec.floorY + spec.height + 0.5, spec.z]} visible={false}>
        <mesh rotation={[Math.PI, 0, 0]} material={outlineMat}>
          <coneGeometry args={[0.15, 0.3, 16]} />
        </mesh>
        <mesh position={[0, 0.28, 0]} material={outlineMat}>
          <cylinderGeometry args={[0.05, 0.05, 0.28, 12]} />
        </mesh>
      </group>

      <pointLight ref={lightRef} position={[-0.7, spec.floorY + spec.height * 0.7, spec.z]} color={HIGHLIGHT_COLOR} intensity={0} distance={4} decay={2} />
    </group>
  );
}
