import { useState } from "react";
import { useFrame } from "@react-three/fiber";
import { timelineStore } from "../state/timelineStore";
import { getSceneAt } from "../timeline/timeline";
import { GlobalAtmosphere } from "../components/Environment/GlobalAtmosphere";
import { SkyDome } from "../components/Environment/SkyDome";
import { CameraDirector } from "../components/Camera/CameraDirector";
import { PostFX } from "../effects/PostFX";
import { AudioDriver } from "../audio/AudioDriver";
import { NarrationDriver } from "../audio/NarrationDriver";
import { EarlyRailScene } from "./EarlyRailScene";
import { BoardingScene } from "./BoardingScene";
import { InteriorScene } from "./InteriorScene";
import { DepartureScene } from "./DepartureScene";
import { JourneyScene } from "./JourneyScene";
import { ExteriorRideScene } from "./ExteriorRideScene";
import { EvolutionScene } from "./EvolutionScene";
import { ModernRideScene } from "./ModernRideScene";
import { ArrivalScene } from "./ArrivalScene";
import type { SceneId } from "../timeline/timeline";

/** Advances the shared timeline clock once per frame. */
function TimelineDriver() {
  useFrame((_, delta) => timelineStore.tick(delta));
  return null;
}

const SCENE_COMPONENTS: Record<SceneId, React.ComponentType> = {
  earlyRail: EarlyRailScene,
  boarding: BoardingScene,
  interior: InteriorScene,
  departure: DepartureScene,
  journey: JourneyScene,
  exteriorRide: ExteriorRideScene,
  evolution: EvolutionScene,
  modernRide: ModernRideScene,
  arrival: ArrivalScene,
};

/**
 * Mounts only the currently active scene's geometry, so idle scenes cost nothing. Re-renders only
 * on an actual scene change (a handful of times over the five minutes), not every tick of the clock.
 */
function ActiveScene() {
  const [sceneId, setSceneId] = useState<SceneId>(() => getSceneAt(timelineStore.getElapsed()).id);

  useFrame(() => {
    const next = getSceneAt(timelineStore.getElapsed()).id;
    if (next !== sceneId) setSceneId(next);
  });

  const Scene = SCENE_COMPONENTS[sceneId];
  return <Scene />;
}

/** Root 3D content for the full five-minute Train Evolution cinematic. */
export function Experience() {
  return (
    <>
      <TimelineDriver />
      {/* Mounted above the scenes, not inside them: the sky and the reflection probe baked from it
          are continuous across every cut, and whichever atmosphere is active simply describes them. */}
      <SkyDome />
      <GlobalAtmosphere />
      <CameraDirector />
      <AudioDriver />
      <NarrationDriver />
      <ActiveScene />
      <PostFX />
    </>
  );
}
