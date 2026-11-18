// Variant definitions + shared tuning for the three candidate open-world games.
// One engine, three cities: the same systems (traffic, police, missions, combat,
// HUD, save) play differently in each because the city, the light, the story and
// the mission chain are all different. The shipped game defaults to the variant
// the builder picked after screenshotting all three.
export const TILE = 64;
export const CITY = 3200; // city is CITY x CITY pixels
export const ROAD_GAP = 400; // distance between road centre-lines
export const ROAD_W = 112; // road width in pixels
export const ROAD_AXES = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];

export const VARIANTS = {
  solmar: {
    id: 'solmar',
    name: 'SOLMAR BAY',
    tagline: 'Sun, sea and a second chance.',
    hero: 'Rico Vega',
    heroBio: 'Ex-getaway driver. Back in Solmar Bay to pay off one last debt.',
    seed: 1337,
    light: 'day',
    camera: 'top',
    palette: {
      ground: '#8a9a5b', grass: '#7fae62', sand: '#e8d5a2', water: '#2fa8c9',
      waterDeep: '#1d7fa8', road: '#3a3f4a', roadLine: '#e8e4c8', sidewalk: '#b9b3a4',
      buildingRoofs: ['#c96f4a', '#d9a05b', '#b85c5c', '#7d8aa5', '#a5876d', '#5f7d6a'],
      parkTree: '#3f7d44', lamp: '#ffd98a', sky: '#ffe9b8',
    },
    clockStart: 9 * 60 + 5, // 09:05
    rain: false,
    accent: '#ff7a1a',
  },
  neon: {
    id: 'neon',
    name: 'NEON HARBOR',
    tagline: 'The city never sleeps. Neither do the cops.',
    hero: 'Nova Reyes',
    heroBio: 'Night courier. Every package is a race against the sirens.',
    seed: 4242,
    light: 'night',
    camera: 'top',
    palette: {
      ground: '#232838', grass: '#1d3a2a', sand: '#3a3348', water: '#0d2b45',
      waterDeep: '#081c30', road: '#171a24', roadLine: '#8a8f7d', sidewalk: '#2c3040',
      buildingRoofs: ['#3a2b52', '#523a5e', '#27354f', '#4a2b3a', '#2b3a4a', '#3f2b4f'],
      parkTree: '#1e4d33', lamp: '#ff9de2', sky: '#120e24',
    },
    clockStart: 22 * 60 + 10, // 22:10
    rain: true,
    accent: '#ff2e88',
  },
  palma: {
    id: 'palma',
    name: 'PALMA VERDE',
    tagline: 'Golden hour. Green palms. One last crew.',
    hero: 'Dante Cruz',
    heroBio: 'Small-time wheelman building a crew to take the Verde crown.',
    seed: 9001,
    light: 'golden',
    camera: 'angled', // buildings drawn with extruded height + long shadows
    palette: {
      ground: '#9a8f5e', grass: '#86a854', sand: '#ecd9a8', water: '#e08a4a',
      waterDeep: '#b96a35', road: '#4a4038', roadLine: '#f2e6b8', sidewalk: '#c9b896',
      buildingRoofs: ['#d97b4f', '#e8b25e', '#c95f5f', '#8a9ab5', '#b59a6d', '#6d8a5f'],
      parkTree: '#4a7d3a', lamp: '#ffcf7a', sky: '#ffb347',
    },
    clockStart: 17 * 60 + 40, // 17:40 golden hour
    rain: false,
    accent: '#ffb300',
  },
};

export const VARIANT_ORDER = ['solmar', 'neon', 'palma'];
export const DEFAULT_VARIANT = 'palma'; // picked after screenshotting all three

export function variantFromQuery(search) {
  const q = new URLSearchParams(search || '');
  const v = (q.get('variant') || '').toLowerCase();
  return VARIANTS[v] ? v : DEFAULT_VARIANT;
}

// Shared tuning: physics, police, economy, combat.
export const TUNE = {
  playerWalk: 165, // px/s on foot
  playerRun: 265,
  playerHealth: 100,
  carAccel: 620, // px/s^2
  carTopSpeed: 560,
  carReverseTop: 200,
  carTurn: 2.9, // rad/s at full lock, scaled by speed
  carGrip: 0.985,
  trafficSpeed: 150,
  policeTopSpeed: 600,
  policeRam: 26,
  bulletSpeed: 780,
  pistolDamage: 34,
  pistolRate: 0.22, // seconds between shots
  enemyDamage: 9,
  starDecaySeconds: 9,
  bustedHoldSeconds: 1.4,
  taxiFareBase: 45,
  packageReward: 100,
  stuntReward: 60,
  saveKey: 'palma-verde-save-v1',
};
