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
- **Environment HDRI**: the reflection probe used to be drei's `<Environment preset="park">`, which
  downloads a prebuilt HDRI from a CDN at run time. That is a third-party asset the project does not
  ship and cannot vouch for offline, and it was also wrong on its own terms: every reflective
  surface in the film mirrored the same bright midsummer park whether the shot was a sunset arrival
  or a lantern-lit pit at dawn. It is now baked from the film's own sky
  ([`src/components/Environment/SkyDome.tsx`](../src/components/Environment/SkyDome.tsx)), so there
  is no network dependency and no third-party image to license.
- **Surface textures**: every colour, roughness, normal and ambient-occlusion map is generated at
  load from tileable fractal noise and 2D canvas drawing — see
  [`src/materials/noise.ts`](../src/materials/noise.ts) and
  [`src/materials/presets.ts`](../src/materials/presets.ts) — rather than downloaded from a texture
  library. Each material derives all four maps from one shared height pattern, so nothing here is a
  third-party image either. The same applies to the trees, hills and mountains, which are generated
  geometry ([`src/components/Environment/naturalGeometry.ts`](../src/components/Environment/naturalGeometry.ts)),
  not downloaded models.
- **Audio**: rather than stock loops, every sound in the cinematic is synthesized in real time from
  Web Audio primitives — see [`src/audio/TrainAudioEngine.ts`](../src/audio/TrainAudioEngine.ts), so
  there is no third-party recording here to license. The continuous layer (engine tone, wheel clack,
  steam chuff, rail noise, brake squeal) is driven every frame from each scene's *actual* speed/era
  state, and the event layer — era-specific whistles and horns, station PA chimes, the guard's pea
  whistle, the coupler snatch, door latch/hiss/thunk, footsteps, tunnel roar and platform crowd
  murmur — is hung on the scenes' own timing constants in
  [`src/audio/sceneAudioCues.ts`](../src/audio/sceneAudioCues.ts).
  `TrainAudioEngine.loadAmbience()` can still layer in a sourced CC0 ambience clip (station/wind) if
  one is added under `public/audio/ambience/`; nothing currently calls it.
