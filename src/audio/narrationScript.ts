/**
 * The spoken commentary, in seven stages: early railways, steam, diesel, electrification,
 * high-speed, smart rail, and what comes next. Every line is hung on the master timeline's absolute
 * clock (see `timeline/timeline.ts`) so it lands on the machine it is describing — the steam loco
 * while it is still simmering, the diesel as it takes the platform, the electric under its wire, the
 * high-speed unit once it is running.
 *
 * The three generations that have their own train on screen (diesel, electrification, high-speed)
 * get 40 seconds each inside the Evolution scene. The stages with no model of their own — the
 * horse-drawn mine wagons of the 1600s, smart rail, and the future — are carried by the opening, the
 * modern unit's ride and the closing arrival respectively.
 *
 * Lines sit in the quiet stretches of each scene rather than over its horns, whistles and door
 * beats, and the last one clears before the closing title card so the film ends on picture.
 */
export interface NarrationLine {
  /** Absolute seconds into the cinematic. */
  t: number;
  text: string;
}

/** Words per second used to estimate how long a line stays on screen when the browser has no speech
 * synthesis to tell us — an unhurried documentary read rather than a conversational pace. */
const WORDS_PER_SECOND = 2.5;

/** Speaking rate for the voice-over: a little under natural so the commentary sits behind the picture. */
export const NARRATION_RATE = 0.92;

export function estimateSeconds(text: string): number {
  return Math.max(2.5, text.split(/\s+/).length / WORDS_PER_SECOND + 0.6);
}

const LINES: NarrationLine[] = [
  // 1. EARLY RAILWAYS (1600s-1700s) — the prologue, over the station and the waiting locomotive.
  { t: 3, text: "Railways did not begin with engines. In the sixteen hundreds, wooden rails ran through mines." },
  { t: 11, text: "The wagons on them were pulled by horses, and by people. The rail came first." },

  // 2. STEAM ERA (1800s) — boarding, the cabin, the departure and the run out of town.
  { t: 20, text: "1804. Richard Trevithick puts a steam engine on rails, and the mine railway becomes a public one." },
  { t: 30, text: "Steam turned coal into distance. Within fifty years, railways carried passengers and freight across whole countries." },
  { t: 44, text: "This is what travel became: timber, brass and oil light, moving faster than anyone had ever gone." },
  { t: 56, text: "The regulator opens. Steam drives the pistons, the rods turn the wheels, and hundreds of tonnes move." },
  { t: 66, text: "But only six percent of that coal becomes movement. The rest goes up the chimney." },
  { t: 76, text: "Coal shovelled by hand, water every forty miles, and hours of work before a single mile is run." },
  { t: 95, text: "For a century and a half this was the fastest thing on earth. Then it stopped being enough." },
  { t: 106, text: "Steam's replacement was already waiting at the next platform." },

  // 3. DIESEL ERA (1900s) — the diesel arrives, is boarded, and is ridden. 40 seconds.
  { t: 121, text: "The diesel locomotive. No fire to light, no water to take on. It starts with a switch." },
  { t: 131, text: "Its engine turns a generator, and electric motors turn the axles. A power station on its own wheels." },
  { t: 141, text: "A third of its fuel becomes movement, it needs far less maintenance, and one person can run it." },
  { t: 150, text: "By the nineteen sixties, most of the world's steam had been cut up for scrap." },

  // 4. ELECTRIFICATION (1900s) — the wire, the cities, the grid. 40 seconds.
  { t: 161, text: "Then the wire. An electric train carries no fuel at all, drawing power from above or from a third rail." },
  { t: 172, text: "Cities took them first: quicker away from a stop, far quieter, and clean where people actually stand." },
  { t: 182, text: "An electric train is only as dirty as the grid behind it, and grids keep getting cleaner." },
  { t: 191, text: "It also made one more thing possible." },

  // 5. HIGH-SPEED RAIL (1960s-present) — the Shinkansen and everything it started. 40 seconds.
  { t: 201, text: "October 1964. Japan opens the Shinkansen at 210 kilometres an hour, on track built for nothing else." },
  { t: 211, text: "No locomotive at all. Motors sit under every carriage, so the whole train pulls itself." },
  { t: 220, text: "France, Germany, Spain, China. China alone now has more high-speed track than the rest of the world." },
  { t: 230, text: "Three hundred kilometres an hour, at ground level, with a cup of coffee on the table." },

  // 6. MODERN SMART RAIL (2000s-present) — riding the modern unit while the network does the work.
  { t: 241, text: "What changed next was not the train. It was everything around it." },
  { t: 249, text: "Automated signalling, satellite positioning, digital tickets, live information. The network became a computer with trains inside it." },
  { t: 260, text: "Trains now brake to save energy, and push power back into the wire every time they slow down." },
  { t: 270, text: "On some lines there is nobody in the cab at all." },

  // 7. FUTURE RAIL — the closing arrival. Nothing is spoken over the final title card.
  { t: 279, text: "What comes next is already being built: autonomous trains, hydrogen and battery power, renewable grids." },
  { t: 287, text: "Two hundred years from a horse on a wooden rail, to this. Same idea, done better." },
];

export const NARRATION: NarrationLine[] = [...LINES].sort((a, b) => a.t - b.t);
