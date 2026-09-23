import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { PerspectiveCamera } from "@react-three/drei";
import { Experience } from "./scenes/Experience";
import { SceneTitle } from "./components/UI/SceneTitle";
import { BoardingCue } from "./components/UI/BoardingCue";
import { Controls } from "./components/UI/Controls";
import { SoundGate } from "./components/UI/SoundGate";
import { CutFade } from "./components/UI/CutFade";
import { EvolutionFootageOverlay } from "./components/UI/EvolutionFootageOverlay";
import { EvolutionEraFade } from "./components/UI/EvolutionEraFade";
import { NarrationCaption } from "./components/UI/NarrationCaption";
import { SplitMirror } from "./effects/SplitMirror";
import { useQuality } from "./effects/renderQuality";
import "./App.css";

/** Per-half HTML overlays — rendered once per screen half so titles/fades match on both sides. */
function EyeOverlays() {
  return (
    <>
      <SceneTitle />
      <BoardingCue />
      <NarrationCaption />
      <CutFade />
      <EvolutionFootageOverlay />
      <EvolutionEraFade />
    </>
  );
}

function App() {
  const [split, setSplit] = useState(true);
  const mirrorRef = useRef<HTMLCanvasElement>(null);
  const quality = useQuality();

  return (
    <div className={split ? "app-root is-split" : "app-root"}>
      <div className="eye">
        <Canvas
          // Was "soft", which asked for PCFSoftShadowMap — a map type three has since deleted, so
          // the renderer silently fell back to hard shadows and the film lost the soft contact
          // edges it was authored with. "percentage" is now the soft one: three r186 filters PCF
          // with a per-pixel-rotated Vogel disk whose spread comes from each light's
          // `shadow.radius` (see `GlobalAtmosphere`), which is the control that actually works.
          shadows="percentage"
          dpr={[1, quality.maxDpr]}
          // The composer owns antialiasing (see `PostFX`), so the canvas must not also pay for it.
          gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        >
          <PerspectiveCamera makeDefault fov={50} near={0.05} far={250} position={[14, 6, 16]} />
          <Experience />
          {split && <SplitMirror target={mirrorRef} />}
        </Canvas>
        <EyeOverlays />
      </div>
      {split && (
        <div className="eye">
          <canvas ref={mirrorRef} />
          <EyeOverlays />
        </div>
      )}
      <Controls split={split} onToggleSplit={() => setSplit((s) => !s)} />
      <SoundGate />
    </div>
  );
}

export default App;
