export type NpcEra = "steam" | "diesel" | "electric" | "modern";
export type HatKind = "none" | "topHat" | "bowler" | "flatCap" | "fedora" | "wideBrim" | "beanie" | "baseballCap";
export type HairStyle = "short" | "long" | "bun" | "bald";
export type Carry = "none" | "suitcase" | "briefcase" | "backpack";

export interface Outfit {
  body: "m" | "f";
  /** Uniform scale around a ~1.76m reference figure. */
  height: number;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  shoes: string;
  hat: HatKind;
  hatColor: string;
  accent: string;
  skirt: "none" | "long" | "knee";
  longCoat: boolean;
  carry: Carry;
  headphones: boolean;
}

/** Small deterministic PRNG (mulberry32) so a crowd looks the same every playthrough and on both split-screen halves. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

const SKIN = ["#f5d6bf", "#f1c9a5", "#e0ac84", "#c68a62", "#9c6644", "#6b4630"];
const HAIR = ["#1b1512", "#2a1a10", "#3b2618", "#6a4a2a", "#a8814f", "#d8c9a8", "#8a8a8a"];

interface EraWardrobe {
  menTop: string[];
  menBottom: string[];
  womenTop: string[];
  womenBottom: string[];
  shoes: string[];
  menHats: HatKind[];
  womenHats: HatKind[];
  hatColors: string[];
  accents: string[];
  skirtChance: number;
  skirtLength: "long" | "knee";
  longCoatChance: number;
  carries: Carry[];
  headphonesChance: number;
}

/** Clothing by generation: Victorian/Edwardian travel wear -> 1950s suits and dresses -> 80s-2000s
 * casual -> present-day hoodies, puffers and sneakers. Keeps each train era's crowd period-correct. */
const WARDROBES: Record<NpcEra, EraWardrobe> = {
  steam: {
    menTop: ["#2b2622", "#3a2e25", "#1f2530", "#4a3a2a", "#2e1f1f"],
    menBottom: ["#3b352e", "#2a2a2a", "#4b4236"],
    womenTop: ["#5c1f2a", "#2f3b4f", "#4a3b2a", "#3e4a3a", "#6b4a5a"],
    womenBottom: ["#3a2a22", "#2a2f3a", "#4a3a3a"],
    shoes: ["#1a1410", "#2a1d14"],
    menHats: ["topHat", "bowler", "bowler", "flatCap", "none"],
    womenHats: ["wideBrim", "wideBrim", "none"],
    hatColors: ["#161412", "#2a221c", "#3a2e22"],
    accents: ["#c9a86a", "#e8e0d0", "#8a2a2a"],
    skirtChance: 1,
    skirtLength: "long",
    longCoatChance: 0.65,
    carries: ["suitcase", "none", "none", "briefcase"],
    headphonesChance: 0,
  },
  diesel: {
    menTop: ["#5a5a5e", "#6b5a48", "#3e4656", "#7a6e5a", "#2f3338"],
    menBottom: ["#4a4a4e", "#5a4a3a", "#33384a"],
    womenTop: ["#c98a8a", "#8ab0c9", "#d9c58a", "#9ac29a", "#e0e0d0"],
    womenBottom: ["#c98a8a", "#6a7a9a", "#8a6a5a", "#3a4a6a"],
    shoes: ["#1a1410", "#3a2616", "#6a1a1a"],
    menHats: ["fedora", "fedora", "none", "flatCap"],
    womenHats: ["none", "none", "wideBrim"],
    hatColors: ["#3a3530", "#5a4a3a", "#2a2a2e"],
    accents: ["#f0ece0", "#b03030", "#303a60"],
    skirtChance: 0.85,
    skirtLength: "knee",
    longCoatChance: 0.35,
    carries: ["suitcase", "briefcase", "none", "none"],
    headphonesChance: 0,
  },
  electric: {
    menTop: ["#2f4f7f", "#7f2f2f", "#3f5f3f", "#b08040", "#555555", "#d8d8d0"],
    menBottom: ["#34507a", "#2a3a55", "#555555", "#8a7a5a"],
    womenTop: ["#9a3a6a", "#2f6f8f", "#d8c070", "#6a4a8a", "#e8e0e0"],
    womenBottom: ["#34507a", "#2a2a2e", "#6a3a4a"],
    shoes: ["#1a1a1a", "#e0e0e0", "#5a3a22"],
    menHats: ["none", "none", "none", "baseballCap"],
    womenHats: ["none"],
    hatColors: ["#2a3a6a", "#8a2a2a"],
    accents: ["#e0e0e0", "#202020", "#c0a040"],
    skirtChance: 0.3,
    skirtLength: "knee",
    longCoatChance: 0.1,
    carries: ["backpack", "briefcase", "none", "suitcase"],
    headphonesChance: 0.1,
  },
  modern: {
    menTop: ["#1e1e22", "#e8e8e8", "#c9463d", "#3f6fb0", "#7a8b5a", "#d9a441", "#4a4f57"],
    menBottom: ["#1d1f24", "#3a4a64", "#8a8378", "#2c2c30"],
    womenTop: ["#f0e6dc", "#1e1e22", "#b85c7a", "#5a8fb0", "#c9b08a", "#6a8a6a"],
    womenBottom: ["#1d1f24", "#3a4a64", "#c9c0b0"],
    shoes: ["#f2f2f2", "#1a1a1a", "#d0d0d0"],
    menHats: ["none", "none", "beanie", "baseballCap"],
    womenHats: ["none", "none", "beanie"],
    hatColors: ["#1e1e22", "#6a6a70", "#c9463d"],
    accents: ["#f2f2f2", "#1a1a1a", "#3aa0e0"],
    skirtChance: 0.15,
    skirtLength: "knee",
    longCoatChance: 0.15,
    carries: ["backpack", "backpack", "none", "suitcase"],
    headphonesChance: 0.35,
  },
};

export function makeOutfit(era: NpcEra, rng: () => number): Outfit {
  const w = WARDROBES[era];
  const body: "m" | "f" = rng() < 0.5 ? "m" : "f";
  const female = body === "f";
  const hat = pick(rng, female ? w.womenHats : w.menHats);
  const skirt = female && rng() < w.skirtChance ? w.skirtLength : "none";
  const hairStyle: HairStyle = female ? pick(rng, era === "steam" ? (["bun"] as const) : (["long", "bun", "short"] as const)) : rng() < 0.12 ? "bald" : "short";
  return {
    body,
    height: female ? 0.92 + rng() * 0.06 : 0.97 + rng() * 0.07,
    skin: pick(rng, SKIN),
    hair: pick(rng, HAIR),
    hairStyle,
    top: pick(rng, female ? w.womenTop : w.menTop),
    bottom: pick(rng, female ? w.womenBottom : w.menBottom),
    shoes: pick(rng, w.shoes),
    hat,
    hatColor: pick(rng, w.hatColors),
    accent: pick(rng, w.accents),
    skirt,
    longCoat: skirt === "none" && rng() < w.longCoatChance,
    carry: pick(rng, w.carries),
    headphones: hat === "none" && rng() < w.headphonesChance,
  };
}
