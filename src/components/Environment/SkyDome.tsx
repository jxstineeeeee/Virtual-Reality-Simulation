import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { skyState } from "../../state/skyState";
import { quality } from "../../effects/renderQuality";

/**
 * Comfortably inside the camera's 250 m far plane, and re-centred on the camera every frame so it
 * can never be reached or clipped.
 */
const SKY_RADIUS = 200;

const VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // The dome is centred on the camera and never rotated, so a vertex's local position *is* the
    // direction the fragment is looking — no matrix work needed to get a view ray.
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform float uCloud;
  uniform float uTime;
  uniform float uDim;
  varying vec3 vDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * vnoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;

    // Rayleigh-ish gradient. The exponent is what keeps the bright horizon band low and tight
    // instead of washing halfway up the frame, which is what a linear mix does and why a linear
    // sky gradient always looks like a poster.
    vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.42));
    // Below the horizon line the dome darkens slightly, so terrain fogging out has something to sit
    // against rather than meeting an identical colour and vanishing into a seam.
    col = mix(col, uHorizon * 0.8, smoothstep(0.0, -0.14, h));

    float sd = max(dot(dir, uSunDir), 0.0);
    // Three terms, because the sun is three things: a wide haze across the whole sun half of the
    // sky, a tight flare, and the disc itself.
    col += uSun * pow(sd, 5.0) * 0.14;
    col += uSun * pow(sd, 220.0) * 0.85;
    col += uSun * smoothstep(0.99930, 0.99975, sd) * 2.6;

    // Clouds live on a flat layer, so the view direction is projected onto it — which is what gives
    // the perspective stretch toward the horizon that a plain spherical noise never has.
    // The cloud height is floored, and the whole layer is faded out low down, because the projection
    // approaches infinite frequency at the horizon and would alias into static.
    float above = max(h, 0.06);
    vec2 cp = dir.xz / above;
    float shape = fbm(cp * 0.5 + vec2(uTime * 0.0055, uTime * 0.003));
    float detail = fbm(cp * 1.8 - vec2(uTime * 0.010, 0.0));
    float n = mix(shape, detail, 0.35);

    float cover = smoothstep(0.60 - uCloud * 0.42, 0.90 - uCloud * 0.34, n);
    cover *= smoothstep(0.03, 0.30, h);
    // Lit tops where the cloud faces the sun, shaded bases away from it.
    vec3 shaded = mix(uZenith, uHorizon, 0.55) * 0.6;
    vec3 cloudCol = mix(shaded, uSun * 1.25, 0.28 + 0.55 * sd * sd);
    col = mix(col, cloudCol, cover);

    gl_FragColor = vec4(col * uDim, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * How much of the sky's own brightness the probe contributes as light.
 *
 * The scene already carries a complete analytic rig — key, ambient and hemisphere — all tuned
 * against the same palette. A probe baked from a full-brightness sky adds a second daylight on top
 * of that, and white liveries clipped to a solid white blob. At this weight the probe does what it
 * is actually wanted for: putting the sun and the sky in the reflections, not relighting the film.
 */
const ENV_INTENSITY = 0.45;

/** Re-baking the reflection probe costs six cube faces plus the mip chain, so it is rate-limited. */
const ENV_INTERVAL = quality.tier === "low" ? 1.2 : 0.3;

function makeSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uHorizon: { value: skyState.horizon.clone() },
      uZenith: { value: skyState.zenith.clone() },
      uSun: { value: skyState.sun.clone() },
      uSunDir: { value: skyState.sunDirection.clone() },
      uCloud: { value: skyState.cloudCover },
      uTime: { value: 0 },
      uDim: { value: 1 },
    },
    side: THREE.BackSide,
    // The sky is behind everything by definition: it must not occlude, and scene fog must not be
    // applied to it (fog would flatten it back to the single colour this replaces).
    depthWrite: false,
    fog: false,
  });
}

/**
 * The reflection probe, baked from the sky itself.
 *
 * This replaces a fixed "park" HDRI fetched from a CDN, which was wrong twice over: every shiny
 * surface in the film reflected the same bright midsummer park regardless of whether the shot was a
 * sunset arrival or a lantern-lit pit at dawn, and the whole thing had to be downloaded before any
 * reflective material looked right. Baking the probe from the dome means the sun sits in the
 * reflections where it sits in the sky, the palette shift of a scene change carries into the glass
 * and the paintwork, and there is no network dependency at all.
 *
 * It re-bakes only when the sky has visibly moved, and no more often than `ENV_INTERVAL` — the
 * palette eases rather than jumps, so this settles to nothing within a second of a scene change.
 */
function useSkyEnvironment(material: THREE.ShaderMaterial) {
  const { gl, scene } = useThree();

  const rig = useMemo(() => {
    const probeScene = new THREE.Scene();
    probeScene.add(new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 24, 16), material));
    return probeScene;
  }, [material]);

  const pmrem = useMemo(() => new THREE.PMREMGenerator(gl), [gl]);
  const target = useRef<THREE.WebGLRenderTarget | null>(null);
  const lastKey = useRef("");
  const cooldown = useRef(0);

  useEffect(() => {
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environmentIntensity = ENV_INTENSITY;
    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      target.current?.dispose();
      pmrem.dispose();
    };
  }, [scene, pmrem]);

  useFrame((_, delta) => {
    cooldown.current -= delta;
    if (cooldown.current > 0) return;

    // Quantised, so the tail of a colour ease stops triggering bakes long before it has finished.
    const u = material.uniforms;
    const q = (c: THREE.Color) => `${(c.r * 24) | 0}${(c.g * 24) | 0}${(c.b * 24) | 0}`;
    const key = `${q(u.uHorizon.value)}|${q(u.uZenith.value)}|${q(u.uSun.value)}|${(u.uCloud.value * 12) | 0}|${(u.uDim.value * 12) | 0}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    cooldown.current = ENV_INTERVAL;

    const previous = target.current;
    // The dome sits at 200 m, so the probe camera's far plane has to reach past it.
    target.current = pmrem.fromScene(rig, 0, 1, SKY_RADIUS * 2);
    scene.environment = target.current.texture;
    previous?.dispose();
  });
}

/**
 * The sky.
 *
 * Both atmospheres previously set `scene.background` to a single flat colour, which meant the top
 * half of nearly every frame in the film was one uniform fill — no gradient, no sun, no cloud, no
 * depth. It is the loudest possible "this is a render" signal, and no amount of work on the
 * geometry below it competes with it.
 *
 * What replaces it is driven entirely from [skyState], which is the same palette the fog and the key
 * light are already built from: the horizon band *is* the fog colour, and the sun sits exactly where
 * the directional light is. So this is not a decorative backdrop bolted on top — it is the existing
 * lighting model finally drawn.
 */
export function SkyDome() {
  const material = useMemo(makeSkyMaterial, []);
  const meshRef = useRef<THREE.Mesh>(null);
  const { scene } = useThree();

  useSkyEnvironment(material);

  useEffect(() => {
    // Nothing sets a background any more; if something still did, it would draw over the dome.
    scene.background = null;
    return () => material.dispose();
  }, [scene, material]);

  useFrame((state, delta) => {
    const u = material.uniforms;
    // Eased rather than copied, so a hard scene cut still gets the brief colour settle the rest of
    // the atmosphere gets — and so the probe above sees a converging target rather than a jump.
    const damp = 1 - Math.pow(0.0015, delta);
    u.uHorizon.value.lerp(skyState.horizon, damp);
    u.uZenith.value.lerp(skyState.zenith, damp);
    u.uSun.value.lerp(skyState.sun, damp);
    u.uSunDir.value.lerp(skyState.sunDirection, damp).normalize();
    u.uCloud.value = THREE.MathUtils.lerp(u.uCloud.value, skyState.cloudCover, damp);
    u.uDim.value = THREE.MathUtils.lerp(u.uDim.value, skyState.dim, damp * 4);
    u.uTime.value = state.clock.elapsedTime;

    // Following the camera is what makes a finite dome behave as an infinite sky: it can never be
    // approached, so it has no parallax, which is exactly how a real horizon behaves.
    meshRef.current?.position.copy(state.camera.position);
  });

  return (
    <mesh ref={meshRef} material={material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[SKY_RADIUS, 48, 32]} />
    </mesh>
  );
}
