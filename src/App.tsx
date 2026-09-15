import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Experience } from "./scenes/Experience";
import { SceneTitle } from "./components/UI/SceneTitle";
import { BoardingCue } from "./components/UI/BoardingCue";
import { Controls } from "./components/UI/Controls";
import { CutFade } from "./components/UI/CutFade";
import { EvolutionFootageOverlay } from "./components/UI/EvolutionFootageOverlay";
import { EvolutionEraFade } from "./components/UI/EvolutionEraFade";
import { SplitMirror } from "./effects/SplitMirror";
import "./App.css";

/** Per-half HTML overlays — rendered once per screen half so titles/fades match on both sides. */
function EyeOverlays() {
  return (
    <>
      <SceneTitle />
      <BoardingCue />
      <CutFade />
      <EvolutionFootageOverlay />
      <EvolutionEraFade />
    </>
  );
}

function App() {
  const [split, setSplit] = useState(true);
  const mirrorRef = useRef<HTMLCanvasElement>(null);

  return (
    <div className={split ? "app-root is-split" : "app-root"}>
      <div className="eye">
        <Canvas shadows dpr={[1, 2]}>
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
    </div>
  );
}

export default App;
