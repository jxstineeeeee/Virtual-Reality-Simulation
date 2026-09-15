import type { CabinPassengerConfig } from "../components/People/Crowds";

/** Every cabin-local Z the ride cameras sit or stand at on the aisle side (Interior, Departure, Journey,
 * ExteriorRide, ModernRide, Arrival shots) — kept free of NPCs in all of them. */
const RIDE_CAMERA_Z = [-1, -0.5, 0.2, 0.5, 1.5];

/** Shared by every steam-cabin scene so the same fellow passengers are there from boarding to arrival. */
export const STEAM_CABIN_PASSENGERS: CabinPassengerConfig = { era: "steam", seed: 21, density: 0.6, avoidZ: RIDE_CAMERA_Z };

/** The modern train is busier, with someone standing at the door pole. */
export const MODERN_CABIN_PASSENGERS: CabinPassengerConfig = { era: "modern", seed: 51, density: 0.8, avoidZ: RIDE_CAMERA_Z, standing: true };

/** Camera [x, z] positions on/near the platform in the Preview and Boarding shots. */
export const STEAM_STATION_AVOID: [number, number][] = [
  [-3.2, 9],
  [-3.3, 10.5],
  [-2.8, 7.9],
  [-2.6, 7.5],
];
