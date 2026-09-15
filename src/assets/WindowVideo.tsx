import { Suspense, useEffect } from "react";
import * as THREE from "three";
import { useVideoTexture } from "@react-three/drei";
import { useAssetExists } from "./useAssetExists";
import { publicAsset } from "./publicAsset";

interface WindowVideoProps {
  /** Path under `public/`, e.g. "/video/window/countryside.mp4". */
  src: string;
  /** Plane size in world units, matching the window opening it fills. */
  size: [number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
  opacity?: number;
}

function VideoPlane({ src, size, position, rotation, opacity = 1 }: WindowVideoProps) {
  const texture = useVideoTexture(src, { muted: true, loop: true, start: true });
  texture.colorSpace = THREE.SRGBColorSpace;

  // The scene only ever mounts its active scene (see `ActiveScene`), so this fires whenever the
  // player leaves — pausing the underlying <video> and freeing the GPU texture immediately rather
  // than leaving it decoding off-screen.
  useEffect(() => {
    return () => {
      const video = texture.image as HTMLVideoElement | undefined;
      video?.pause();
      texture.dispose();
    };
  }, [texture]);

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

/**
 * Real footage mapped onto a plane just behind the cabin window glass. Renders nothing when the
 * clip isn't present under `public/video/...` — callers keep their 3D scenery mounted behind this
 * at the same depth so the window reads correctly either way, with no visible seam or broken frame.
 */
export function WindowVideo(props: WindowVideoProps) {
  const url = publicAsset(props.src);
  const exists = useAssetExists(url);
  if (!exists) return null;
  return (
    <Suspense fallback={null}>
      <VideoPlane {...props} src={url} />
    </Suspense>
  );
}
