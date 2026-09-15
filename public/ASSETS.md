# Sourced real-world assets

Every non-procedural asset in this project is logged here with its source and license, per the
realism-upgrade brief's requirement to only use assets we own, that are licensed for use, public
domain, or Creative Commons with compatible permissions.

## Video

| File | Source | License | Used for |
|---|---|---|---|
| `video/evolution/steam-cab-driver.webm` | [Wikimedia Commons — "L steam locomotive - driver's cabin"](https://commons.wikimedia.org/wiki/File:L_steam_locomotive_-_driver's_cabin.webm), by AvAst Dazmen | CC BY 3.0 | Brief (~2.6s) real-footage cinematic insert during the Evolution scene's steam era ([`EvolutionFootageOverlay.tsx`](../src/components/UI/EvolutionFootageOverlay.tsx)) |

## Notes on what was *not* sourced, and why

- **3D train models**: the best free sources (Sketchfab) gate downloads behind a login-walled JS UI
  that isn't fetchable headlessly, and a generic downloaded GLB wouldn't have the wheel-rotation/door
  animation rig this project's train components already drive. Instead, the procedural train models
  got a detail/material pass (see git history for `src/components/Train/*`), and
  [`src/assets/TrainModel.tsx`](../src/assets/TrainModel.tsx) transparently loads a real
  `public/models/train/<era>.glb` in place of the procedural mesh the moment one is added — no code
  change needed.
- **Window footage (countryside/mountain/city)**: candidates found either carried a non-commercial
  license (archive.org's best match, CC BY-NC-SA) or weren't genuine train-POV footage. Rather than
  use a legally-murky or mismatched clip, the main journey window keeps the upgraded procedural 3D
  scenery + real glass material. [`src/assets/WindowVideo.tsx`](../src/assets/WindowVideo.tsx) is
  ready to display a real clip the moment one is dropped into `public/video/window/` — see its
  usage note in `JourneyScene.tsx`.
- **Audio**: rather than stock loops, train sound (engine, wheel-clack, brake, door) is synthesized in
  real time from the actual per-scene speed/era state — see
  [`src/audio/TrainAudioEngine.ts`](../src/audio/TrainAudioEngine.ts). `TrainAudioEngine.loadAmbience()`
  can layer in a sourced CC0 ambience clip (station/wind) if one is added under `public/audio/ambience/`.
