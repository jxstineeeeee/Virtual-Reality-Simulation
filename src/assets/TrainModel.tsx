import { Suspense, Component, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useAssetExists } from "./useAssetExists";
import { publicAsset } from "./publicAsset";

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

/** Catches GLTFLoader parse/network failures so a corrupt or unexpected file falls back cleanly
 * instead of taking down the whole cinematic. */
class GltfErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function GltfScene({ src }: { src: string }) {
  const { scene } = useGLTF(src);
  return <primitive object={scene} />;
}

interface TrainModelProps {
  /** Path under `public/`, e.g. "/models/train/steam.glb". */
  src: string;
  /** The existing procedural train JSX, rendered whenever the real model isn't present (or fails). */
  fallback: ReactNode;
}

/**
 * Renders a real GLB model when one has been dropped into `public/models/train/`, otherwise renders
 * the procedural fallback — so supplying a real asset later needs no code change, and a missing or
 * broken file never breaks the scene.
 */
export function TrainModel({ src, fallback }: TrainModelProps) {
  const url = publicAsset(src);
  const exists = useAssetExists(url);
  if (exists !== true) return <>{fallback}</>;
  return (
    <GltfErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GltfScene src={url} />
      </Suspense>
    </GltfErrorBoundary>
  );
}
