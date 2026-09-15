export type AudioEra = "idle" | "steam" | "diesel" | "electric" | "modern";

interface UpdateOpts {
  /** Arbitrary world-units/sec, whatever scale the calling scene already uses for motion. */
  speed: number;
  era: AudioEra;
  interior: boolean;
  braking: boolean;
}

const BASE_PITCH: Record<AudioEra, number> = { idle: 26, steam: 22, diesel: 34, electric: 90, modern: 70 };

/**
 * Synthesizes train audio in real time from Web Audio API primitives, driven every frame by the
 * cinematic's actual speed/era state (via `update`) rather than looping a fixed stock recording —
 * so wheel-clack rate, engine timbre, and brake/door one-shots always match what's on screen.
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

  private clackDistance = 0;
  private muted = false;
  private unmutedVolume = 0.55;

  /** Must be called from a user-gesture handler (browser autoplay policy). No-op once started. */
  start() {
    if (this.ctx) return;
    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.unmutedVolume;
    master.connect(ctx.destination);
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

    // Broadband rail/steam noise bed: filtered white noise, sweeps + gain react per-frame.
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0;
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start();
    this.noiseFilter = noiseFilter;
    this.noiseGain = noiseGain;

    const ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0.5;
    ambienceGain.connect(master);
    this.ambienceGain = ambienceGain;
  }

  get isMuted() {
    return this.muted;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.unmutedVolume, this.ctx.currentTime, 0.05);
    }
  }

  /** Call once per frame with the current simulation state. */
  update({ speed, era, interior, braking }: UpdateOpts) {
    const ctx = this.ctx;
    if (!ctx || !this.engineGain || !this.engineFilter || !this.noiseGain || !this.noiseFilter) return;
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
    const engineLevel = (moving ? 0.14 + speedN * 0.18 : era === "idle" ? 0 : 0.04) * (interior ? 0.7 : 1);
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.3);

    this.noiseFilter.frequency.setTargetAtTime(era === "steam" ? 1600 : 900, t, 0.5);
    const noiseLevel = moving ? 0.05 + speedN * 0.12 : 0;
    this.noiseGain.gain.setTargetAtTime(noiseLevel, t, 0.25);

    // Wheel clack: one short click roughly every rail-joint length of travel; rate rises with speed.
    this.clackDistance += speed / 60;
    if (moving && this.clackDistance >= 1.2) {
      this.clackDistance = 0;
      this.playClack(speedN);
    }

    if (braking && Math.random() < 0.02) this.playBrakeSqueal();
  }

  private playClack(intensity: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 120 + Math.random() * 40;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12 + intensity * 0.1, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.09);
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
    gain.gain.linearRampToValueAtTime(0.05, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  /** One-shot pneumatic door hiss (filtered noise burst) — call on door-open/close transitions. */
  playDoorHiss() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const dur = 0.5;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 2000;
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  /** Loads and loops a sourced ambience clip (station/wind) at low volume, if present. No-op on any failure. */
  async loadAmbience(url: string) {
    const ctx = this.ctx;
    if (!ctx || !this.ambienceGain) return;
    try {
      const res = await fetch(url);
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
