import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { timelineStore } from "../../state/timelineStore";
import { woodGrainTexture } from "../../materials/presets";

/** Where the waggonway disappears into the hillside. The loaded wagons are brought out of here. */
export const ADIT_Z = 15.5;

const LANTERN_COLOR = "#ffb257";
/** Lantern posts down the near stretch of the waggonway, [x, z]. */
const LANTERN_POSTS: [number, number][] = [
  [1.85, 11.5],
  [-1.85, 6.5],
  [1.85, 1],
  [-1.85, -5],
];

function Timber({
  position,
  size,
  rotation,
  color = "#4a3826",
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.92} />
    </mesh>
  );
}

/** A hanging oil lantern: pierced tin body, a horn pane, and a real point light so it lifts the dirt around it. */
export function Lantern({ position, intensity = 1, seed = 0 }: { position: [number, number, number]; intensity?: number; seed?: number }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const flameRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    // A wick gutters; two off-ratio waves keep it from pulsing like a metronome.
    const t = timelineStore.getElapsed() + seed;
    const flicker = 0.82 + Math.sin(t * 7.3) * 0.1 + Math.sin(t * 17.1) * 0.06;
    if (lightRef.current) lightRef.current.intensity = intensity * flicker;
    if (flameRef.current) flameRef.current.emissiveIntensity = 2.4 * flicker;
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.13, 0]}>
        <torusGeometry args={[0.035, 0.008, 6, 12, Math.PI]} />
        <meshStandardMaterial color="#3a3229" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh castShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.16, 8]} />
        <meshStandardMaterial color="#4a4036" metalness={0.55} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.005, 0]}>
        <cylinderGeometry args={[0.038, 0.038, 0.1, 8]} />
        <meshStandardMaterial ref={flameRef} color="#ffe6bb" emissive={LANTERN_COLOR} emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.09, 0]}>
        <coneGeometry args={[0.07, 0.05, 8]} />
        <meshStandardMaterial color="#3a3229" metalness={0.6} roughness={0.5} />
      </mesh>
      <pointLight ref={lightRef} color={LANTERN_COLOR} intensity={intensity} distance={4.5} decay={2} />
    </group>
  );
}

/** The pit-head shaft gear: a timber headframe with a winding wheel turning over the shaft. */
function Headframe({ position }: { position: [number, number, number] }) {
  const wheelRef = useRef<THREE.Group>(null);
  const ropeRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    // The wheel turns while a corf is wound up, then rests — a shaft is not hoisting continuously.
    const t = timelineStore.getElapsed();
    const cycle = t % 14;
    const hoisting = cycle < 8;
    if (wheelRef.current && hoisting) wheelRef.current.rotation.z += 0.03;
    if (ropeRef.current) {
      const rise = hoisting ? Math.min(cycle / 8, 1) : 1;
      ropeRef.current.scale.y = 1 - rise * 0.75;
      ropeRef.current.position.y = -1.6 * (1 - rise * 0.75);
    }
  });

  return (
    <group position={position}>
      {/* Four raking legs braced into a head */}
      {([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => (
        <Timber key={`${sx}${sz}`} position={[sx * 0.85, 2.2, sz * 0.85]} size={[0.16, 4.6, 0.16]} rotation={[sz * -0.16, 0, sx * 0.16]} />
      ))}
      <Timber position={[0, 4.4, 0]} size={[2.1, 0.18, 2.1]} />
      {[1.2, 2.8].map((y) => (
        <group key={y}>
          <Timber position={[0, y, 0.95]} size={[2, 0.12, 0.12]} />
          <Timber position={[0, y, -0.95]} size={[2, 0.12, 0.12]} />
        </group>
      ))}
      {/* Winding wheel, axle lying across the track direction */}
      <group ref={wheelRef} position={[0, 4.85, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh castShadow>
          <torusGeometry args={[0.85, 0.07, 8, 24]} />
          <meshStandardMaterial color="#3d332a" metalness={0.5} roughness={0.7} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]} castShadow>
            <boxGeometry args={[1.7, 0.05, 0.05]} />
            <meshStandardMaterial color="#4a3826" roughness={0.9} />
          </mesh>
        ))}
      </group>
      {/* Hoist rope, shortening as a corf of coal comes up the shaft */}
      <mesh ref={ropeRef} position={[0, -1.6, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 6.4, 6]} />
        <meshStandardMaterial color="#6a5a44" roughness={0.95} />
      </mesh>
      {/* Timbered shaft collar at ground level */}
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[1.9, 0.3, 1.9]} />
        <meshStandardMaterial color="#3a2c1e" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.5, 0.3, 1.5]} />
        <meshStandardMaterial color="#0d0b09" roughness={1} />
      </mesh>
    </group>
  );
}

/** A coal fire in an iron basket, lighting the loading bank and the faces around it. */
function Brazier({ position }: { position: [number, number, number] }) {
  const lightRef = useRef<THREE.PointLight>(null);
  const emberRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const t = timelineStore.getElapsed();
    const flicker = 0.75 + Math.sin(t * 5.1) * 0.15 + Math.sin(t * 12.7) * 0.1;
    if (lightRef.current) lightRef.current.intensity = 2.6 * flicker;
    if (emberRef.current) emberRef.current.emissiveIntensity = 3 * flicker;
  });

  return (
    <group position={position}>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.18, 0.3, sz * 0.18]} rotation={[sz * 0.12, 0, -sx * 0.12]} castShadow>
            <cylinderGeometry args={[0.02, 0.025, 0.62, 6]} />
            <meshStandardMaterial color="#2e2820" metalness={0.6} roughness={0.6} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.66, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.24, 0.26, 10, 1, true]} />
        <meshStandardMaterial color="#2e2820" metalness={0.65} roughness={0.55} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.72, 0]}>
        <sphereGeometry args={[0.26, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial ref={emberRef} color="#ff7a2a" emissive="#ff6a1e" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <pointLight ref={lightRef} color="#ff8d3a" intensity={2.6} distance={7} decay={2} position={[0, 0.8, 0]} />
    </group>
  );
}

/** Picks, shovels and sledges leaned against a timber rack, the way a shift leaves its tools. */
function ToolRack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Timber position={[0, 0.6, 0]} size={[1.6, 0.1, 0.1]} />
      <Timber position={[-0.75, 0.3, 0]} size={[0.1, 0.6, 0.1]} />
      <Timber position={[0.75, 0.3, 0]} size={[0.1, 0.6, 0.1]} />
      {[-0.55, -0.2, 0.15, 0.5].map((x, i) => (
        <group key={x} position={[x, 0, 0]} rotation={[0.34, 0, (i % 2 === 0 ? 1 : -1) * 0.05]}>
          <mesh position={[0, 0.55, 0.18]} castShadow>
            <cylinderGeometry args={[0.022, 0.026, 1.15, 6]} />
            <meshStandardMaterial color="#6a5236" roughness={0.9} />
          </mesh>
          {i % 2 === 0 ? (
            <mesh position={[0, 1.1, 0.36]} rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.018, 0.012, 0.44, 6]} />
              <meshStandardMaterial color="#4a443c" metalness={0.75} roughness={0.5} />
            </mesh>
          ) : (
            <mesh position={[0, 1.12, 0.38]} rotation={[0.1, 0, 0]} castShadow>
              <boxGeometry args={[0.2, 0.26, 0.02]} />
              <meshStandardMaterial color="#4a443c" metalness={0.75} roughness={0.45} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/**
 * The surface of a 17th-century coal pit: the hillside adit the waggonway runs out of, the timber
 * headframe over the shaft, spoil heaps, stacked props, barrels, tools, and the lanterns and coal
 * fire that are the only light there is on a working bank.
 */
export function MineWorkings() {
  const hillMap = useMemo(() => {
    const tex = woodGrainTexture().clone();
    tex.repeat.set(6, 3);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <group>
      {/* Hillside the adit is driven into, with the waggonway running out through its mouth */}
      <mesh position={[0, 2.6, ADIT_Z + 4.5]} receiveShadow castShadow>
        <boxGeometry args={[42, 6, 11]} />
        <meshStandardMaterial color="#4f4337" map={hillMap} roughness={1} />
      </mesh>
      {/* Adit portal: a timber frame set into the hill, dark inside */}
      <group position={[0, 0, ADIT_Z]}>
        <mesh position={[0, 1.15, 0.2]}>
          <boxGeometry args={[2.3, 2.3, 2]} />
          <meshStandardMaterial color="#0a0908" roughness={1} />
        </mesh>
        <Timber position={[-1.32, 1.2, 0]} size={[0.24, 2.6, 0.3]} />
        <Timber position={[1.32, 1.2, 0]} size={[0.24, 2.6, 0.3]} />
        <Timber position={[0, 2.58, 0]} size={[2.95, 0.3, 0.34]} />
        <Timber position={[0, 2.85, -0.1]} size={[3.3, 0.22, 0.22]} rotation={[0, 0, 0.03]} />
        {/* A lamp just inside the mouth, so the adit reads as worked rather than abandoned */}
        <Lantern position={[0.75, 1.5, 0.4]} intensity={0.9} seed={3.2} />
      </group>

      {/* Spoil heaps either side of the bank */}
      {([[-9, 12, 3.4], [-12.5, 6, 2.4], [8.5, 13, 2.8], [11, 4, 2]] as const).map(([x, z, s]) => (
        <mesh key={`${x}${z}`} position={[x, s * 0.34, z]} rotation={[0, x, 0]} castShadow receiveShadow>
          <coneGeometry args={[s, s * 0.8, 9]} />
          <meshStandardMaterial color="#3b332a" roughness={1} />
        </mesh>
      ))}

      <Headframe position={[-6.4, 0, 9]} />

      {/* Winding house / lean-to shed beside the shaft */}
      <group position={[-9.6, 0, 4.2]} rotation={[0, 0.3, 0]}>
        <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.4, 2.2, 2.6]} />
          <meshStandardMaterial color="#4a3826" roughness={0.95} />
        </mesh>
        <mesh position={[0, 2.5, 0]} rotation={[0, 0, 0.18]} castShadow>
          <boxGeometry args={[3.9, 0.14, 3]} />
          <meshStandardMaterial color="#2f261c" roughness={0.95} />
        </mesh>
        <mesh position={[1.72, 0.85, 0]}>
          <boxGeometry args={[0.05, 1.7, 0.9]} />
          <meshStandardMaterial color="#1a1410" roughness={0.9} />
        </mesh>
        <Lantern position={[1.85, 1.9, 0.9]} intensity={0.8} seed={8.6} />
      </group>

      {/* Stacked pit props waiting to go underground */}
      <group position={[3.6, 0, 11.5]} rotation={[0, 0.2, 0]}>
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((i) => (
            <Timber
              key={`${row}-${i}`}
              position={[i * 0.26 + (row % 2) * 0.13, 0.13 + row * 0.25, 0]}
              size={[0.24, 0.24, 2.4]}
              color={row % 2 === 0 ? "#4a3826" : "#42311f"}
            />
          )),
        )}
      </group>

      {/* Barrels of tallow and blasting powder under the shed wall */}
      {([[-7.4, 2.4], [-7, 1.7], [-6.4, 2.6]] as const).map(([x, z], i) => (
        <mesh key={x} position={[x, 0.32, z]} rotation={[0, i, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.3, 0.27, 0.64, 12]} />
          <meshStandardMaterial color="#54402a" roughness={0.9} />
        </mesh>
      ))}

      <ToolRack position={[2.9, 0, 8.2]} />
      <Brazier position={[2.6, 0, 5.4]} />

      {LANTERN_POSTS.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.85, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.07, 1.7, 6]} />
            <meshStandardMaterial color="#42311f" roughness={0.92} />
          </mesh>
          <mesh position={[Math.sign(-x) * 0.15, 1.66, 0]}>
            <boxGeometry args={[0.34, 0.06, 0.06]} />
            <meshStandardMaterial color="#42311f" roughness={0.92} />
          </mesh>
          <Lantern position={[Math.sign(-x) * 0.3, 1.5, 0]} intensity={1.1} seed={x * 3 + z} />
        </group>
      ))}
    </group>
  );
}
