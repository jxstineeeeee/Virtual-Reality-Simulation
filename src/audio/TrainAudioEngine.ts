import { publicAsset } from "../assets/publicAsset";

export type AudioEra = "idle" | "steam" | "diesel" | "electric" | "modern";

interface UpdateOpts {
  /** Arbitrary world-units/sec, whatever scale the calling scene already uses for motion. */
  speed: number;
  era: AudioEra;
  interior: boolean;
  braking: boolean;
  /** 0..1 how loud the station crowd should be — i.e. how many people are on screen right now. */
  crowd: number;
  /** 0..1 how deep inside a tunnel the train is (same factor that darkens the cabin). */
  tunnel: number;
}

const BASE_PITCH: Record<AudioEra, number> = { idle: 26, steam: 22, diesel: 34, electric: 90, modern: 70 };

/** World-units of travel between wheel clacks (rail joints) and between steam chimney beats. */
const CLACK_SPACING = 1.2;
const CHUFF_SPACING = 0.75;

interface HornVoice {
  /** Stacked into a chord for steam/diesel; played as a two-tone sequence for electric/modern. */
  freqs: number[];
  type: OscillatorType;
  seconds: number;
  peak: number;
  /** Lowpass cutoff — what separates a bright steam whistle from a dark diesel horn. */
  cutoff: number;
  /** How much breathy noise rides on top (a steam whistle is mostly air). */
  breath: number;
}

const HORN: Record<AudioEra, HornVoice> = {
  // A three-note chime whistle, bright and airy, with a long tail.
  steam: { freqs: [523, 659, 784], type: "triangle", seconds: 1.9, peak: 0.26, cutoff: 3200, breath: 0.12 },
  // Low, reedy, two-tone — the classic North American diesel air horn.
  diesel: { freqs: [175, 233, 349], type: "sawtooth", seconds: 1.6, peak: 0.24, cutoff: 1100, breath: 0.04 },
  // Electric/modern units use a short electronic two-tone rather than a chord.
  electric: { freqs: [392, 523], type: "square", seconds: 0.9, peak: 0.2, cutoff: 1800, breath: 0 },
  modern: { freqs: [587, 880], type: "sine", seconds: 0.8, peak: 0.22, cutoff: 2800, breath: 0 },
  idle: { freqs: [523, 659, 784], type: "triangle", seconds: 1.9, peak: 0.26, cutoff: 3200, breath: 0.12 },
};

/**
 * Synthesizes train audio in real time from Web Audio API primitives, driven every frame by the
 * cinematic's actual speed/era/door state (via `update` plus the one-shot `play*` calls) rather than
 * looping fixed stock recordings — so wheel-clack rate, chuff rhythm, engine timbre and every horn,
 * whistle and hiss always match what's on screen.
 *
 * Sounds that belong to the world outside the carriage (horns, station crowd, platform PA) run
 * through `outsideFilter`, which closes down to a muffle whenever the viewer is inside a cabin; the
 * viewer's own train (wheels, engine, footsteps) bypasses it.
 */
export class TrainAudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private ambienceGain: GainNode | null = null;
  /** Everything heard through the carriage wall/window, so one filter muffles it all at once. */
  private outsideFilter: BiquadFilterNode | null = null;
  private crowdGain: GainNode | null = null;
  private tunnelGain: GainNode | null = null;
  /** One shared noise buffer, re-used by every noise-based one-shot instead of reallocating. */
  private noiseBuffer: AudioBuffer | null = null;

  private clackDistance = 0;
  private chuffDistance = 0;
  private muted = false;
  private playing = true;
  private unmutedVolume = 0.8;

  /** Must be called from a user-gesture handler (browser autoplay policy). No-op once started. */
  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;

    // A limiter on the way out: horn + crowd + clacks + chuff can all land together, and without
    // this their sum clips into distortion on the busier platform scenes.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 4;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.2;
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = this.masterTarget();
    master.connect(limiter);
    this.master = master;

    // Continuous engine tone: two oscillators through a lowpass; pitch/timbre/level all driven per-frame.
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = "lowpass";
    engineFilter.frequency.value = 300;
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.value = 40;
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = 60;
    osc1.connect(engineFilter);
    osc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    osc1.start();
    osc2.start();
    this.engineOsc = osc1;
    this.engineOsc2 = osc2;
    this.engineFilter = engineFilter;
    this.engineGain = engineGain;

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = noiseBuffer;

    // Broadband rail/steam noise bed: filtered white noise, sweeps + gain react per-frame.
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    this.loopNoise(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    this.noiseFilter = noiseFilter;
    this.noiseGain = noiseGain;

    // Muffling bus for everything outside the carriage — cutoff is driven per-frame in `update`.
    const outsideFilter = ctx.createBiquadFilter();
    outsideFilter.type = "lowpass";
    outsideFilter.frequency.value = 18000;
    outsideFilter.connect(master);
    this.outsideFilter = outsideFilter;

    // Station crowd bed: a soft band of noise sitting in the voice range, topped up in `update` with
    // occasional individual murmurs so a busy platform doesn't read as one flat hiss.
    const crowdFilter = ctx.createBiquadFilter();
    crowdFilter.type = "bandpass";
    crowdFilter.frequency.value = 550;
    crowdFilter.Q.value = 1.1;
    const crowdGain = ctx.createGain();
    crowdGain.gain.value = 0;
    this.loopNoise(crowdFilter);
    crowdFilter.connect(crowdGain);
    crowdGain.connect(outsideFilter);
    this.crowdGain = crowdGain;

    // Tunnel roar: low rumble that swells as the train is swallowed by the tunnel.
    const tunnelFilter = ctx.createBiquadFilter();
    tunnelFilter.type = "lowpass";
    tunnelFilter.frequency.value = 320;
    const tunnelGain = ctx.createGain();
    tunnelGain.gain.value = 0;
    this.loopNoise(tunnelFilter);
    tunnelFilter.connect(tunnelGain);
    tunnelGain.connect(master);
    this.tunnelGain = tunnelGain;

    const ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0.5;
    ambienceGain.connect(outsideFilter);
    this.ambienceGain = ambienceGain;
  }

  /** Starts a looping white-noise source into `dest`. Used for every continuous noise bed. */
  private loopNoise(dest: AudioNode) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.connect(dest);
    src.start(ctx.currentTime + Math.random() * 0.5); // decorrelate the beds so they don't phase together
  }

  get isMuted() {
    return this.muted;
  }

  private masterTarget(): number {
    return this.muted || !this.playing ? 0 : this.unmutedVolume;
  }

  private applyMasterGain() {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(this.masterTarget(), this.ctx.currentTime, 0.05);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMasterGain();
  }

  /**
   * Follows the timeline's play/pause state: a paused cinematic still runs the render loop, so
   * without this the engine would keep humming over a frozen picture.
   */
  setPlaying(playing: boolean) {
    if (playing === this.playing) return;
    this.playing = playing;
    if (playing) void this.ctx?.resume();
    this.applyMasterGain();
  }

  /** One-shots are dropped while paused/muted so a burst doesn't queue up behind a silent master. */
  private get audible(): boolean {
    return this.ctx !== null && this.playing && !this.muted;
  }

  /** Call once per frame with the current simulation state. */
  update({ speed, era, interior, braking, crowd, tunnel }: UpdateOpts) {
    const ctx = this.ctx;
    if (!ctx || !this.engineGain || !this.engineFilter || !this.noiseGain || !this.noiseFilter) return;
    if (!this.playing) return;
    const t = ctx.currentTime;
    const moving = speed > 0.02;
    // Soft compression so scenes with wildly different speed scales (0.2 .. 17) all map into 0..1.
    const speedN = moving ? 1 - Math.exp(-speed / 2) : 0;

    const basePitch = BASE_PITCH[era];
    const pitch = basePitch + speedN * basePitch * 0.6;
    this.engineOsc?.frequency.setTargetAtTime(pitch, t, 0.4);
    this.engineOsc2?.frequency.setTargetAtTime(pitch * 1.5, t, 0.4);
    if (this.engineOsc) this.engineOsc.type = era === "electric" || era === "modern" ? "sine" : "sawtooth";
    this.engineFilter.frequency.setTargetAtTime(200 + speedN * 900, t, 0.5);
    const engineLevel = (moving ? 0.2 + speedN * 0.24 : era === "idle" ? 0 : 0.1) * (interior ? 0.7 : 1);
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.3);

    this.noiseFilter.frequency.setTargetAtTime(era === "steam" ? 1600 : 900, t, 0.5);
    // Inside a tunnel the rail noise has nowhere to escape, so the bed swells with the roar.
    // A standing steam loco still simmers on the safety valve — without this the platform scenes,
    // where nothing is moving at all, come out silent.
    const standingHiss = era === "steam" ? 0.05 : 0;
    const noiseLevel = moving ? (0.08 + speedN * 0.16) * (1 + tunnel * 0.8) : standingHiss;
    this.noiseGain.gain.setTargetAtTime(noiseLevel, t, 0.25);

    // Closed carriage windows muffle the world outside; a tunnel closes it down further still.
    const outsideCutoff = (interior ? 900 : 18000) * (1 - tunnel * 0.6);
    this.outsideFilter?.frequency.setTargetAtTime(Math.max(outsideCutoff, 240), t, 0.35);
    this.crowdGain?.gain.setTargetAtTime(crowd * 0.2, t, 0.6);
    this.tunnelGain?.gain.setTargetAtTime(tunnel * speedN * 0.3, t, 0.3);

    // Wheel clack: a short double-click roughly every rail-joint length of travel; rate rises with speed.
    this.clackDistance += speed / 60;
    if (moving && this.clackDistance >= CLACK_SPACING) {
      this.clackDistance = 0;
      this.playClack(speedN);
    }

    // Steam locos beat four times per driving-wheel revolution — the chuff the whole era is known for.
    if (era === "steam") {
      this.chuffDistance += speed / 60;
      if (moving && this.chuffDistance >= CHUFF_SPACING) {
        this.chuffDistance = 0;
        this.playChuff(speedN, interior);
      }
    }

    // A pantograph arcing on the overhead wire, matching the spark that's visible on screen.
    if (era === "electric" && moving && Math.random() < 0.03) this.playCrackle();

    // Individual voices lifting out of the crowd bed.
    if (crowd > 0.05 && Math.random() < crowd * 0.05) this.playMurmur();

    if (braking && Math.random() < 0.02) this.playBrakeSqueal();
  }

  /** Short noise burst through `filter`, the shape behind most of the percussive one-shots. */
  private noiseBurst(seconds: number, peak: number, filter: BiquadFilterNode, dest: AudioNode, shape: "decay" | "swell" = "decay") {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    if (shape === "swell") {
      gain.gain.linearRampToValueAtTime(peak, t + seconds * 0.35);
    } else {
      gain.gain.linearRampToValueAtTime(peak, t + Math.min(0.01, seconds * 0.1));
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + seconds + 0.02);
  }

  private makeFilter(type: BiquadFilterType, frequency: number, q = 1): BiquadFilterNode {
    const filter = this.ctx!.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    return filter;
  }

  private playClack(intensity: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    // Bogies run in pairs, so each joint gives the familiar "da-dum" rather than a single tick.
    this.clackTick(ctx.currentTime, intensity);
    this.clackTick(ctx.currentTime + 0.1 - intensity * 0.05, intensity * 0.7);
  }

  private clackTick(t: number, intensity: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 120 + Math.random() * 40;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.18 + intensity * 0.14, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  /** The steam loco's chimney beat: a sharp puff of air with a falling pitch. */
  private playChuff(intensity: number, interior: boolean) {
    if (!this.ctx || !this.master) return;
    const filter = this.makeFilter("bandpass", 900 + intensity * 500, 0.8);
    const t = this.ctx.currentTime;
    filter.frequency.exponentialRampToValueAtTime(320, t + 0.22);
    this.noiseBurst(0.26, (0.16 + intensity * 0.12) * (interior ? 0.45 : 1), filter, this.master);
  }

  private playCrackle() {
    if (!this.ctx || !this.outsideFilter) return;
    this.noiseBurst(0.06, 0.06, this.makeFilter("highpass", 4000), this.outsideFilter);
  }

  /** One indistinct voice out of the platform crowd. */
  private playMurmur() {
    if (!this.ctx || !this.outsideFilter) return;
    const filter = this.makeFilter("bandpass", 320 + Math.random() * 500, 3.5);
    this.noiseBurst(0.2 + Math.random() * 0.25, 0.07, filter, this.outsideFilter, "swell");
  }

  private playBrakeSqueal() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(2200 + Math.random() * 400, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** The long sigh of air as the brakes let go once the train is finally at a stand. */
  playBrakeRelease() {
    if (!this.audible || !this.master) return;
    this.noiseBurst(1.4, 0.16, this.makeFilter("bandpass", 1400, 0.7), this.master);
  }

  /** One-shot pneumatic door hiss (filtered noise burst) — call on door-open/close transitions. */
  playDoorHiss() {
    if (!this.audible || !this.master) return;
    this.noiseBurst(0.5, 0.28, this.makeFilter("highpass", 2000), this.master);
  }

  /** The heavy wooden/metal thunk of a carriage door shutting. */
  playDoorThunk() {
    const ctx = this.ctx;
    if (!this.audible || !ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.31);
    this.noiseBurst(0.12, 0.16, this.makeFilter("lowpass", 900), this.master);
  }

  /** Slack running out through the couplers as the train takes up the strain — a rolling series of clanks. */
  playCouplerClunk() {
    const ctx = this.ctx;
    if (!this.audible || !ctx || !this.master) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = t0 + i * (0.07 + Math.random() * 0.05);
      const osc = ctx.createOscillator();
      osc.type = "square";
      osc.frequency.setValueAtTime(210 - i * 20 + Math.random() * 30, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.22 - i * 0.03, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.19);
    }
  }

  /**
   * The train's own warning: a chime whistle for steam, an air horn for diesel, a short electronic
   * two-tone for the electric and modern units — see `HORN`.
   */
  playHorn(era: AudioEra) {
    const ctx = this.ctx;
    if (!this.audible || !ctx || !this.outsideFilter) return;
    const voice = HORN[era];
    const t0 = ctx.currentTime;
    const twoTone = era === "electric" || era === "modern";

    voice.freqs.forEach((freq, i) => {
      // Steam/diesel sound all their notes together as a chord; the modern units alternate two tones,
      // so each of those notes has to fit inside the horn's total length rather than take all of it.
      const seconds = twoTone ? voice.seconds * 0.55 : voice.seconds;
      const t = twoTone ? t0 + i * voice.seconds * 0.5 : t0;
      const osc = ctx.createOscillator();
      osc.type = voice.type;
      osc.frequency.setValueAtTime(freq, t);
      // A whistle sags a little as the pressure behind it drops.
      osc.frequency.linearRampToValueAtTime(freq * 0.99, t + seconds);
      osc.detune.value = (Math.random() - 0.5) * 12;
      const filter = this.makeFilter("lowpass", voice.cutoff);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(voice.peak, t + (twoTone ? 0.02 : 0.12));
      gain.gain.setValueAtTime(voice.peak, t + seconds * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.outsideFilter!);
      osc.start(t);
      osc.stop(t + seconds + 0.02);
    });

    if (voice.breath > 0) {
      const filter = this.makeFilter("bandpass", 2600, 0.8);
      this.noiseBurst(voice.seconds, voice.breath, filter, this.outsideFilter, "swell");
    }
  }

  /** The guard's pea whistle on the platform: short, shrill, two blasts. */
  playConductorWhistle() {
    const ctx = this.ctx;
    if (!this.audible || !ctx || !this.outsideFilter) return;
    const t0 = ctx.currentTime;
    for (const offset of [0, 0.42]) {
      const t = t0 + offset;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(2350, t);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      // The trill of the pea rattling inside the whistle.
      const trill = ctx.createOscillator();
      trill.type = "sine";
      trill.frequency.value = 28;
      const trillDepth = ctx.createGain();
      trillDepth.gain.value = 180;
      trill.connect(trillDepth);
      trillDepth.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(this.outsideFilter!);
      trill.start(t);
      osc.start(t);
      trill.stop(t + 0.32);
      osc.stop(t + 0.32);
    }
  }

  /** The station's three-note PA chime, before an announcement nobody ever quite catches. */
  playStationChime() {
    const ctx = this.ctx;
    if (!this.audible || !ctx || !this.outsideFilter) return;
    const t0 = ctx.currentTime;
    [784, 659, 523].forEach((freq, i) => {
      const t = t0 + i * 0.42;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const partial = ctx.createOscillator();
      partial.type = "sine";
      partial.frequency.value = freq * 2.01; // a touch sharp, so it rings like a bell rather than a tone
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(gain);
      partial.connect(gain);
      gain.connect(this.outsideFilter!);
      osc.start(t);
      partial.start(t);
      osc.stop(t + 1.12);
      partial.stop(t + 1.12);
    });
  }

  /** A single footfall — `hollow` for the wooden footboard/carriage floor, otherwise stone platform. */
  playFootstep(hollow = false) {
    if (!this.audible || !this.master) return;
    const filter = this.makeFilter("lowpass", hollow ? 420 : 900, 1.4);
    this.noiseBurst(hollow ? 0.16 : 0.1, hollow ? 0.12 : 0.09, filter, this.master);
  }

  /** Loads and loops a sourced ambience clip (station/wind) at low volume, if present. No-op on any failure. */
  async loadAmbience(path: string) {
    const ctx = this.ctx;
    if (!ctx || !this.ambienceGain) return;
    try {
      const res = await fetch(publicAsset(path));
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arr);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.ambienceGain);
      src.start();
    } catch {
      // Sourced ambience is a nice-to-have — silently skip on any fetch/decode failure.
    }
  }
}

export const trainAudio = new TrainAudioEngine();
