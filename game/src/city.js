// Procedural city generation: roads, blocks, buildings, parks, beach and
// landmarks. Deterministic per variant seed. Also the road-network queries the
// traffic AI, the police and the missions use to move around the city.
import { CITY, ROAD_AXES, ROAD_W } from './config.js';
import { makeRng } from './rng.js';

export function buildCity(variant) {
  const rng = makeRng(variant.seed);
  const pal = variant.palette;

  // Roads: centre-lines on both axes. A road is the strip |coord - axis| < ROAD_W/2.
  const roads = { axes: ROAD_AXES.slice(), width: ROAD_W };

  // Beach: the eastern strip is sand, then open water.
  const beach = { x0: CITY - 190, x1: CITY, waterX0: CITY - 60 };

  // Blocks: the squares between neighbouring road axes.
  const blocks = [];
  const landmarks = {};
  for (let bx = 0; bx < ROAD_AXES.length - 1; bx++) {
    for (let by = 0; by < ROAD_AXES.length - 1; by++) {
      const x0 = ROAD_AXES[bx] + ROAD_W / 2 + 14;
      const y0 = ROAD_AXES[by] + ROAD_W / 2 + 14;
      const x1 = ROAD_AXES[bx + 1] - ROAD_W / 2 - 14;
      const y1 = ROAD_AXES[by + 1] - ROAD_W / 2 - 14;
      blocks.push({ bx, by, x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
    }
  }

  // Landmark blocks, fixed by grid position so missions can find them.
  const landmarkDefs = [
    { key: 'hospital', bx: 1, by: 1, label: 'Solmar General', color: '#e8e8e8' },
    { key: 'police', bx: 5, by: 1, label: 'Harbor PD HQ', color: '#5a6b8a' },
    { key: 'stadium', bx: 1, by: 5, label: 'Bay Arena', color: '#7a8a5a' },
    { key: 'mall', bx: 3, by: 3, label: 'Palma Mall', color: '#c9a86a' },
    { key: 'airport', bx: 5, by: 5, label: 'Verde Airfield', color: '#8a8f96' },
    { key: 'safehouse', bx: 2, by: 4, label: 'Safehouse', color: '#a5876d' },
    { key: 'garage', bx: 4, by: 2, label: "Rosa's Garage", color: '#b85c5c' },
    { key: 'pier', bx: 6, by: 3, label: 'Sunset Pier', color: '#8a6a4a' },
  ];
  for (const def of landmarkDefs) {
    const b = blocks.find((bb) => bb.bx === def.bx && bb.by === def.by);
    if (b) landmarks[def.key] = { ...b, ...def };
  }

  // Fill every block: buildings, a park, a parking lot or a plaza.
  const buildings = [];
  const parks = [];
  const parkingLots = [];
  for (const b of blocks) {
    const isLandmark = Object.values(landmarks).some((l) => l.bx === b.bx && l.by === b.by);
    if (isLandmark) {
      // Landmark block: one big building + forecourt.
      buildings.push({
        x: b.x0 + 26, y: b.y0 + 26, w: b.x1 - b.x0 - 52, h: b.y1 - b.y0 - 52,
        color: landmarks[Object.keys(landmarks).find((k) => landmarks[k].bx === b.bx && landmarks[k].by === b.by)].color,
        height: rng.int(14, 26), roof: 'landmark',
        label: landmarks[Object.keys(landmarks).find((k) => landmarks[k].bx === b.bx && landmarks[k].by === b.by)].label,
      });
      continue;
    }
    const roll = rng.next();
    if (roll < 0.16) {
      // Park: grass + trees + a pond or a court.
      const trees = [];
      const n = rng.int(7, 13);
      for (let i = 0; i < n; i++) {
        trees.push({ x: rng.range(b.x0 + 20, b.x1 - 20), y: rng.range(b.y0 + 20, b.y1 - 20), r: rng.range(9, 16) });
      }
      parks.push({ ...b, trees, pond: rng.chance(0.4) });
    } else if (roll < 0.28) {
      parkingLots.push({ ...b });
    } else {
      // 1-4 buildings with alleys between them.
      const cols = rng.chance(0.5) ? 1 : 2;
      const rows = rng.chance(0.6) ? 1 : 2;
      const cw = (b.x1 - b.x0 - (cols - 1) * 18) / cols;
      const ch = (b.y1 - b.y0 - (rows - 1) * 18) / rows;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const inset = rng.range(4, 14);
          buildings.push({
            x: b.x0 + cx * (cw + 18) + inset,
            y: b.y0 + cy * (ch + 18) + inset,
            w: cw - inset * 2,
            h: ch - inset * 2,
            color: rng.pick(pal.buildingRoofs),
            height: rng.int(6, 30),
            roof: rng.pick(['flat', 'flat', 'ac', 'pool', 'garden']),
            label: null,
          });
        }
      }
    }
  }

  // Street names, one per axis, for the HUD + minimap flavour.
  const streetNamesH = ['Ocean Dr', 'Palm Row', 'Coral Ave', 'Banyan St', 'Marina Blvd', 'Cactus Ln', 'Harbor Way', 'Sunset Rd'];
  const streetNamesV = ['1st St', '2nd St', '3rd St', '4th St', '5th St', '6th St', '7th St', '8th St'];

  // Parked cars live in parking lots + along roads.
  const parkedSpots = [];
  for (const lot of parkingLots) {
    const n = rng.int(3, 6);
    let placed = 0;
    let guard = 0;
    while (placed < n && guard < 40) {
      guard += 1;
      const spot = {
        x: rng.range(lot.x0 + 30, lot.x1 - 30),
        y: rng.range(lot.y0 + 30, lot.y1 - 30),
        angle: rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      };
      // Never park two cars on top of each other.
      if (parkedSpots.some((s) => Math.hypot(s.x - spot.x, s.y - spot.y) < 74)) continue;
      parkedSpots.push(spot);
      placed += 1;
    }
  }

  return {
    variant, rng, roads, beach, blocks, buildings, parks, parkingLots,
    landmarks, streetNamesH, streetNamesV, parkedSpots,
  };
}

// ---- road-network queries -------------------------------------------------

export function isOnRoad(city, x, y) {
  for (const a of city.roads.axes) {
    if (Math.abs(x - a) < ROAD_W / 2 + 4) return true;
    if (Math.abs(y - a) < ROAD_W / 2 + 4) return true;
  }
  return false;
}

export function nearestAxis(city, v) {
  let best = city.roads.axes[0];
  let bd = Infinity;
  for (const a of city.roads.axes) {
    const d = Math.abs(v - a);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

// Nearest point on the road network to (x, y): snap to the closest axis.
export function nearestRoadPoint(city, x, y) {
  const ax = nearestAxis(city, x);
  const ay = nearestAxis(city, y);
  const dx = Math.abs(x - ax);
  const dy = Math.abs(y - ay);
  if (dx < dy) return { x: ax, y, vertical: true };
  return { x, y: ay, vertical: false };
}

export function randomRoadPoint(city, rng) {
  const vertical = rng.chance(0.5);
  const axis = rng.pick(city.roads.axes);
  const along = rng.range(120, CITY - 120);
  return vertical ? { x: axis, y: along, vertical: true } : { x: along, y: axis, vertical: false };
}

export function pointInBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

export function clampToCity(x, y, m = 30) {
  return { x: Math.max(m, Math.min(CITY - m, x)), y: Math.max(m, Math.min(CITY - m, y)) };
}

export function streetNameAt(city, x, y) {
  const hx = nearestAxis(city, x);
  const hy = nearestAxis(city, y);
  const hi = city.roads.axes.indexOf(hx);
  const vi = city.roads.axes.indexOf(hy);
  return city.streetNamesV[vi] + ' & ' + city.streetNamesH[hi];
}
