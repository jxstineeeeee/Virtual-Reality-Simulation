import { trainAudio } from "./TrainAudioEngine";
import { NARRATION_RATE, estimateSeconds, type NarrationLine } from "./narrationScript";

type Listener = () => void;

/** How far the train/station audio drops while a line is being spoken, so the voice stays on top. */
const DUCK_LEVEL = 0.45;

/** Voices are ranked by these fragments (best first): a steady, natural English read suits the film
 * better than whichever voice the browser happens to list first, which is often a robotic default. */
const VOICE_PREFERENCES = [
  "google uk english male",
  "google uk english",
  "microsoft ryan",
  "microsoft guy",
  "microsoft aria",
  "daniel",
  "arthur",
  "google us english",
  "microsoft david",
  "samantha",
];

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase();
  const i = VOICE_PREFERENCES.findIndex((p) => name.includes(p));
  if (i >= 0) return 100 - i;
  if (voice.lang.toLowerCase().startsWith("en-gb")) return 20;
  if (voice.lang.toLowerCase().startsWith("en")) return 10;
  return 0;
}

/**
 * The cinematic's narrator. Lines come from `narrationScript` and are spoken through the browser's
 * own speech synthesis — no recorded voice track to ship, and nothing to keep in sync with the
 * 8-minute clock beyond the moment each line is fired.
 *
 * The same lines are always published as on-screen captions, so the commentary still reads on a
 * browser with no voices installed, on a muted phone, or for anyone who simply can't hear it. While
 * a line is speaking the synthesized train audio ducks underneath it.
 */
class NarrationEngine {
  private listeners = new Set<Listener>();
  private caption = "";
  private enabled = true;
  private muted = false;
  private playing = true;
  private speaking = false;
  /** Fallback caption timer, used only when the browser cannot actually speak the line. */
  private captionTimer: ReturnType<typeof setTimeout> | null = null;
  private captionRemaining = 0;
  private captionStartedAt = 0;
  private voice: SpeechSynthesisVoice | null = null;
  private watchingVoices = false;

  private get synth(): SpeechSynthesis | null {
    return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
  }

  /** Whether this browser can actually speak; captions are shown either way. */
  get canSpeak(): boolean {
    return this.synth !== null;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getCaption = (): string => this.caption;
  getEnabled = (): boolean => this.enabled;

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private setCaption(text: string) {
    if (this.caption === text) return;
    this.caption = text;
    this.notify();
  }

  /**
   * Warms up speech synthesis from inside a user gesture: browsers load the voice list lazily, and
   * iOS will not speak at all until an utterance has been started by a tap. Safe to call repeatedly.
   */
  prime() {
    const synth = this.synth;
    if (!synth) return;
    this.pickVoice();
    if (!this.watchingVoices) {
      this.watchingVoices = true;
      // Chrome populates the voice list asynchronously, usually after this first call.
      synth.addEventListener("voiceschanged", () => this.pickVoice());
    }
    // A single space is enough to open the speech channel without the viewer hearing anything.
    const warmUp = new SpeechSynthesisUtterance(" ");
    warmUp.volume = 0;
    synth.speak(warmUp);
  }

  private pickVoice() {
    const voices = this.synth?.getVoices() ?? [];
    if (!voices.length) return;
    this.voice = voices.reduce((best, v) => (scoreVoice(v) > scoreVoice(best) ? v : best), voices[0]);
  }

  setEnabled(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (!enabled) this.stop();
    this.notify();
  }

  /** Follows the transport's own mute button: the voice goes quiet with everything else. */
  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.synth?.cancel();
    this.endLine();
  }

  /** Follows the timeline: a paused film holds its caption and stops speaking mid-sentence. */
  setPlaying(playing: boolean) {
    if (playing === this.playing) return;
    this.playing = playing;
    const synth = this.synth;
    if (playing) {
      synth?.resume();
      if (this.captionRemaining > 0) this.startCaptionTimer(this.captionRemaining);
    } else {
      synth?.pause();
      this.holdCaptionTimer();
    }
  }

  /** Speaks (and captions) one line, cutting off anything still running from the line before. */
  speak(line: NarrationLine) {
    if (!this.enabled) return;
    this.clearCaptionTimer();
    this.setCaption(line.text);
    const synth = this.synth;
    if (!synth || this.muted) {
      // No voice available (or the film is muted): the caption alone carries the commentary, so it
      // has to time itself out rather than waiting for an utterance that will never end.
      this.startCaptionTimer(estimateSeconds(line.text));
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(line.text);
    if (this.voice) {
      utterance.voice = this.voice;
      utterance.lang = this.voice.lang;
    }
    utterance.rate = NARRATION_RATE;
    utterance.pitch = 0.95;
    utterance.volume = 1;
    utterance.onstart = () => {
      this.speaking = true;
      trainAudio.setDuck(DUCK_LEVEL);
    };
    utterance.onend = () => this.endLine();
    utterance.onerror = () => {
      // Usually a `cancel()` from the next line, but a refused utterance would otherwise leave the
      // caption on screen forever — time it out like the no-voice case.
      if (this.caption === line.text) this.startCaptionTimer(estimateSeconds(line.text));
      this.endLine(false);
    };
    synth.speak(utterance);
    trainAudio.setDuck(DUCK_LEVEL);
  }

  /** Cuts the narrator off — a restart, or the viewer turning the voice-over off. */
  stop() {
    this.synth?.cancel();
    this.clearCaptionTimer();
    this.setCaption("");
    this.endLine();
  }

  private endLine(clearCaption = true) {
    this.speaking = false;
    trainAudio.setDuck(1);
    if (clearCaption && this.captionTimer === null) this.setCaption("");
  }

  private startCaptionTimer(seconds: number) {
    this.clearCaptionTimer();
    this.captionRemaining = seconds;
    this.captionStartedAt = Date.now();
    this.captionTimer = setTimeout(() => {
      this.captionTimer = null;
      this.captionRemaining = 0;
      if (!this.speaking) this.setCaption("");
    }, seconds * 1000);
  }

  /** Freezes a fallback caption where it is while the film is paused. */
  private holdCaptionTimer() {
    if (this.captionTimer === null) return;
    clearTimeout(this.captionTimer);
    this.captionTimer = null;
    this.captionRemaining = Math.max(this.captionRemaining - (Date.now() - this.captionStartedAt) / 1000, 0.3);
  }

  private clearCaptionTimer() {
    if (this.captionTimer !== null) clearTimeout(this.captionTimer);
    this.captionTimer = null;
    this.captionRemaining = 0;
  }
}

export const narration = new NarrationEngine();
