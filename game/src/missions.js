// Missions and side activities. Each variant has its own 6-mission story chain
// plus the same open-world side work: taxi fares, hidden packages and stunt
// jumps. A mission is a list of steps; the engine tracks the current step, its
// marker, its timer and its reward.
import { TUNE } from './config.js';
import { makeEnemy } from './combat.js';

function L(city, key) {
  const l = city.landmarks[key];
  return l ? { x: l.cx, y: l.cy } : { x: 1600, y: 1600 };
}

export function missionChains(city) {
  const hospital = L(city, 'hospital');
  const police = L(city, 'police');
  const stadium = L(city, 'stadium');
  const mall = L(city, 'mall');
  const airport = L(city, 'airport');
  const safehouse = L(city, 'safehouse');
  const garage = L(city, 'garage');
  const pier = L(city, 'pier');
  return {
    solmar: [
      {
        id: 's1', title: 'First Fare', reward: 150,
        brief: "Rosa needs a driver. Pick up the passenger at the pier and drop them at the mall. No scratches — the car is borrowed.",
        steps: [
          { type: 'goto', x: pier.x, y: pier.y + 90, label: 'Pick up the passenger at Sunset Pier' },
          { type: 'deliver', x: mall.x, y: mall.y + 90, label: 'Drop the passenger at Palma Mall', inCar: true },
        ],
      },
      {
        id: 's2', title: 'The Pickup', reward: 250,
        brief: 'A package is waiting by the airfield fence. Grab it on foot and bring it back to the garage. Watch for patrols.',
        steps: [
          { type: 'pickup', x: airport.x - 90, y: airport.y + 120, label: 'Pick up the package at Verde Airfield' },
          { type: 'goto', x: garage.x, y: garage.y + 80, label: 'Deliver the package to Rosa\u2019s Garage' },
        ],
      },
      {
        id: 's3', title: 'Getaway', reward: 400,
        brief: 'The crew hit a job and the cops are coming. Grab the crew at the stadium, then lose the heat at the safehouse.',
        steps: [
          { type: 'goto', x: stadium.x, y: stadium.y + 100, label: 'Pick up the crew at Bay Arena', inCar: true },
          { type: 'escape', label: 'Lose the cops, then reach the safehouse' },
        ],
        onStart(G) {
          G.wanted = Math.max(G.wanted, 2);
          G.addMessage('The crew is in — lose the cops!', '#ff5a5a');
        },
        escapeTarget: safehouse,
      },
      {
        id: 's4', title: 'Hot Wheels', reward: 500,
        brief: "A cherry-red sports car is parked behind the garage. Take it — quietly — and park it in the garage forecourt.",
        steps: [
          { type: 'steal', x: garage.x, y: garage.y + 130, label: 'Steal the red sports car' },
          { type: 'deliver', x: garage.x, y: garage.y + 60, label: 'Park it at Rosa\u2019s Garage', inCar: true },
        ],
      },
      {
        id: 's5', title: 'Bank Job', reward: 800,
        brief: 'The Harbor PD HQ is crawling with guards. Take them down, grab the evidence locker cash, and get out alive.',
        steps: [
          { type: 'kill', n: 4, x: police.x, y: police.y + 90, label: 'Take down the guards at Harbor PD HQ' },
          { type: 'pickup', x: police.x + 60, y: police.y + 90, label: 'Grab the cash from the evidence locker' },
          { type: 'goto', x: safehouse.x, y: safehouse.y + 80, label: 'Get back to the safehouse' },
        ],
        onStart(G) {
          spawnGuards(G, police.x, police.y + 90, 4);
        },
      },
      {
        id: 's6', title: 'The Big Score', reward: 1500,
        brief: 'One last job: the mall vault at closing time. Fight through the guards, grab the vault, and vanish into the night at the pier.',
        steps: [
          { type: 'kill', n: 5, x: mall.x, y: mall.y + 90, label: 'Clear the guards at Palma Mall' },
          { type: 'pickup', x: mall.x + 40, y: mall.y + 120, label: 'Grab the vault cash' },
          { type: 'goto', x: pier.x, y: pier.y + 90, label: 'Escape to Sunset Pier' },
        ],
        onStart(G) {
          spawnGuards(G, mall.x, mall.y + 90, 5);
          G.wanted = Math.max(G.wanted, 3);
        },
      },
    ],
    neon: [
      {
        id: 'n1', title: 'Midnight Run', reward: 150,
        brief: 'First drop of the night: pick up the parcel at the pier and run it to the mall before the clock hits midnight.',
        steps: [
          { type: 'pickup', x: pier.x, y: pier.y + 90, label: 'Pick up the parcel at Sunset Pier' },
          { type: 'deliver', x: mall.x, y: mall.y + 90, label: 'Deliver to Palma Mall — fast', inCar: true, time: 75 },
        ],
      },
      {
        id: 'n2', title: 'Neon Nights', reward: 300,
        brief: 'Three drops, one night. Hit the hospital, the arena and the airfield. The city never sleeps — neither do the cops.',
        steps: [
          { type: 'goto', x: hospital.x, y: hospital.y + 90, label: 'Drop 1/3 — Solmar General' },
          { type: 'goto', x: stadium.x, y: stadium.y + 100, label: 'Drop 2/3 — Bay Arena' },
          { type: 'goto', x: airport.x - 90, y: airport.y + 120, label: 'Drop 3/3 — Verde Airfield' },
        ],
      },
      {
        id: 'n3', title: 'Heat Wave', reward: 450,
        brief: 'You were made. Three stars and climbing. Lose the whole city, then cool off at the safehouse.',
        steps: [{ type: 'escape', label: 'Lose the cops, then reach the safehouse' }],
        onStart(G) { G.wanted = 3; },
        escapeTarget: safehouse,
      },
      {
        id: 'n4', title: 'Ghost Ride', reward: 550,
        brief: "A black sports car, no plates, parked by the garage. Take it and ghost it to the pier without being seen.",
        steps: [
          { type: 'steal', x: garage.x, y: garage.y + 130, label: 'Steal the black sports car' },
          { type: 'deliver', x: pier.x, y: pier.y + 90, label: 'Deliver it to Sunset Pier', inCar: true },
        ],
      },
      {
        id: 'n5', title: 'Blackout', reward: 900,
        brief: 'The PD evidence room holds a ledger with your name on it. Fight in, take it, and disappear.',
        steps: [
          { type: 'kill', n: 4, x: police.x, y: police.y + 90, label: 'Take down the guards at Harbor PD HQ' },
          { type: 'pickup', x: police.x + 60, y: police.y + 90, label: 'Grab the ledger' },
          { type: 'goto', x: safehouse.x, y: safehouse.y + 80, label: 'Vanish at the safehouse' },
        ],
        onStart(G) { spawnGuards(G, police.x, police.y + 90, 4); },
      },
      {
        id: 'n6', title: 'The Last Drop', reward: 1600,
        brief: 'The final run: five guards between you and the vault at the mall. Take the cash, outrun the whole harbor, and end it at the pier.',
        steps: [
          { type: 'kill', n: 5, x: mall.x, y: mall.y + 90, label: 'Clear the guards at Palma Mall' },
          { type: 'pickup', x: mall.x + 40, y: mall.y + 120, label: 'Grab the vault cash' },
          { type: 'goto', x: pier.x, y: pier.y + 90, label: 'Escape to Sunset Pier' },
        ],
        onStart(G) {
          spawnGuards(G, mall.x, mall.y + 90, 5);
          G.wanted = Math.max(G.wanted, 3);
        },
      },
    ],
    palma: [
      {
        id: 'p1', title: 'New in Town', reward: 150,
        brief: 'Dante just rolled into Verde. Earn your first dollars: pick up a fare at the pier and drop them at the mall.',
        steps: [
          { type: 'goto', x: pier.x, y: pier.y + 90, label: 'Pick up a fare at Sunset Pier' },
          { type: 'deliver', x: mall.x, y: mall.y + 90, label: 'Drop the fare at Palma Mall', inCar: true },
        ],
      },
      {
        id: 'p2', title: 'Cab Rank', reward: 250,
        brief: 'The crew needs a wheelman who knows every street. Run three fares: hospital, arena, airfield.',
        steps: [
          { type: 'goto', x: hospital.x, y: hospital.y + 90, label: 'Fare 1/3 — Solmar General' },
          { type: 'goto', x: stadium.x, y: stadium.y + 100, label: 'Fare 2/3 — Bay Arena' },
          { type: 'goto', x: airport.x - 90, y: airport.y + 120, label: 'Fare 3/3 — Verde Airfield' },
        ],
      },
      {
        id: 'p3', title: 'The Collection', reward: 400,
        brief: 'Someone owes Rosa money. Collect the envelope at the stadium, then lose the two-star tail on the way home.',
        steps: [
          { type: 'pickup', x: stadium.x, y: stadium.y + 100, label: 'Collect the envelope at Bay Arena' },
          { type: 'escape', label: 'Lose the cops, then reach the safehouse' },
        ],
        onStart(G) { G.wanted = Math.max(G.wanted, 2); },
        escapeTarget: safehouse,
      },
      {
        id: 'p4', title: 'Joyride', reward: 500,
        brief: 'A gold sports car is parked behind the garage. Borrow it permanently and show it off at the pier.',
        steps: [
          { type: 'steal', x: garage.x, y: garage.y + 130, label: 'Steal the gold sports car' },
          { type: 'deliver', x: pier.x, y: pier.y + 90, label: 'Show it off at Sunset Pier', inCar: true },
        ],
      },
      {
        id: 'p5', title: 'Turbulence', reward: 850,
        brief: 'Rival crew at the airfield. Clear them out and take the stash they are guarding.',
        steps: [
          { type: 'kill', n: 4, x: airport.x - 90, y: airport.y + 120, label: 'Clear the rivals at Verde Airfield' },
          { type: 'pickup', x: airport.x - 40, y: airport.y + 120, label: 'Take the stash' },
          { type: 'goto', x: garage.x, y: garage.y + 80, label: 'Bring it to Rosa\u2019s Garage' },
        ],
        onStart(G) { spawnGuards(G, airport.x - 90, airport.y + 120, 4); },
      },
      {
        id: 'p6', title: 'King of Verde', reward: 1600,
        brief: 'The crown job: the mall vault, five guards, the whole harbor on your tail. Finish at the pier and Verde is yours.',
        steps: [
          { type: 'kill', n: 5, x: mall.x, y: mall.y + 90, label: 'Clear the guards at Palma Mall' },
          { type: 'pickup', x: mall.x + 40, y: mall.y + 120, label: 'Grab the vault cash' },
          { type: 'goto', x: pier.x, y: pier.y + 90, label: 'Escape to Sunset Pier' },
        ],
        onStart(G) {
          spawnGuards(G, mall.x, mall.y + 90, 5);
          G.wanted = Math.max(G.wanted, 3);
        },
      },
    ],
  };
}

function spawnGuards(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    const e = makeEnemy(x + G.rng.range(-90, 90), y + G.rng.range(-70, 70), G.rng);
    G.enemies.push(e);
  }
  G.addMessage('Armed guards ahead!', '#ff5a5a');
}

// ---- mission engine ----------------------------------------------------------

export function makeMissionState(G) {
  const chains = missionChains(G.city);
  return {
    chain: chains[G.variant.id],
    index: G.save?.missionsDone || 0,
    active: null, // {def, stepIndex, kills, timer, pickupAt}
    completedAll: false,
  };
}

export function startNextMission(G) {
  const ms = G.mission;
  if (ms.index >= ms.chain.length) {
    ms.completedAll = true;
    G.addMessage('All missions complete — you own this city!', '#ffd98a');
    return false;
  }
  const def = ms.chain[ms.index];
  ms.active = { def, stepIndex: 0, kills: 0, timer: 0, pickupAt: null };
  if (def.onStart) def.onStart(G);
  G.addMessage('Mission: ' + def.title + ' — ' + def.brief, '#ffd98a');
  G.sounds.pickup();
  return true;
}

export function currentStep(G) {
  const a = G.mission.active;
  return a ? a.def.steps[a.stepIndex] : null;
}

export function missionMarker(G) {
  const step = currentStep(G);
  if (!step) return null;
  if (step.type === 'escape') {
    const t = G.mission.active.def.escapeTarget;
    return t && G.wanted === 0 ? { x: t.cx, y: t.cy } : null;
  }
  return { x: step.x, y: step.y };
}

function advanceStep(G) {
  const a = G.mission.active;
  a.stepIndex += 1;
  a.kills = 0;
  a.timer = 0;
  if (a.stepIndex >= a.def.steps.length) completeMission(G);
  else G.sounds.pickup();
}

export function completeMission(G) {
  const a = G.mission.active;
  const def = a.def;
  G.cash += def.reward;
  G.stats.missionsDone = (G.stats.missionsDone || 0) + 1;
  G.mission.index += 1;
  G.mission.active = null;
  G.addMessage('Mission complete: ' + def.title + ' — +$' + def.reward, '#9fe8a9');
  G.sounds.missionDone();
  G.saveGame();
}

export function failMission(G, reason) {
  const a = G.mission.active;
  if (!a) return;
  G.mission.active = null;
  G.enemies = [];
  G.addMessage('Mission failed: ' + reason + ' — press Enter to retry', '#ff5a5a');
  G.sounds.missionFail();
}

export function updateMissions(G, dt) {
  const a = G.mission.active;
  if (!a) return;
  const step = a.def.steps[a.stepIndex];
  const p = G.player;
  const dist = (x, y) => Math.hypot(p.x - x, p.y - y);

  if (step.time) {
    a.timer += dt;
    if (a.timer > step.time) {
      failMission(G, 'Out of time');
      return;
    }
  }

  switch (step.type) {
    case 'goto':
    case 'deliver': {
      if (dist(step.x, step.y) < 64 && (!step.inCar || !p.onFoot)) advanceStep(G);
      break;
    }
    case 'pickup': {
      if (dist(step.x, step.y) < 52) {
        G.addParticles(step.x, step.y, 14, '#ffd98a');
        G.sounds.pickup();
        advanceStep(G);
      }
      break;
    }
    case 'steal': {
      if (!p.onFoot && p.car) advanceStep(G);
      break;
    }
    case 'kill': {
      // Count kills near the objective since the step started.
      const near = G.stats.kills - (a.killsBase ?? (a.killsBase = G.stats.kills || 0));
      if (near >= step.n) advanceStep(G);
      break;
    }
    case 'escape': {
      if (G.wanted === 0) {
        const t = a.def.escapeTarget;
        if (t && dist(t.cx, t.cy) < 90) advanceStep(G);
      }
      break;
    }
    default:
      break;
  }
}

// ---- side activities ------------------------------------------------------------
// Hidden packages: 12 glowing cases scattered around the city, $100 each.
export function spawnPackages(G) {
  G.packages = [];
  for (let i = 0; i < 12; i++) {
    const b = G.rng.pick(G.city.blocks);
    G.packages.push({
      x: b.cx + G.rng.range(-80, 80),
      y: b.cy + G.rng.range(-80, 80),
      taken: false,
    });
  }
}

export function updateSideActivities(G, dt) {
  const p = G.player;
  // Packages.
  for (const pk of G.packages) {
    if (!pk.taken && Math.hypot(p.x - pk.x, p.y - pk.y) < 34) {
      pk.taken = true;
      G.cash += TUNE.packageReward;
      G.stats.packages = (G.stats.packages || 0) + 1;
      G.addMessage('Hidden package found — +$' + TUNE.packageReward + ' (' + G.stats.packages + '/12)', '#ffd98a');
      G.sounds.cash();
    }
  }
  // Taxi fares: a waiting passenger appears near the player now and then.
  if (!G.taxi && G.taxiCooldown <= 0 && !p.onFoot === false) {
    // Offer a fare: passenger a short walk/drive away.
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(200, 420);
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    if (x > 80 && y > 80 && x < 3120 && y < 3120) {
      const dest = G.rng.pick(G.city.blocks);
      G.taxi = {
        pickup: { x, y },
        dest: { x: dest.cx, y: dest.cy },
        state: 'waiting',
        fare: TUNE.taxiFareBase + G.rng.int(0, 80),
      };
    }
    G.taxiCooldown = 14;
  }
  G.taxiCooldown = Math.max(0, (G.taxiCooldown || 0) - dt);
  if (G.taxi) {
    const t = G.taxi;
    if (t.state === 'waiting' && Math.hypot(p.x - t.pickup.x, p.y - t.pickup.y) < 46) {
      t.state = 'riding';
      G.addMessage('Passenger aboard — drive to the marker', '#ffd98a');
      G.sounds.pickup();
    } else if (t.state === 'riding') {
      if (!p.onFoot && p.car && Math.hypot(p.x - t.dest.x, p.y - t.dest.y) < 70) {
        G.cash += t.fare;
        G.stats.fares = (G.stats.fares || 0) + 1;
        G.addMessage('Fare complete — +$' + t.fare, '#9fe8a9');
        G.sounds.cash();
        G.taxi = null;
        G.taxiCooldown = 10;
      } else if (p.onFoot) {
        // Passenger walks off if you leave the car.
        G.taxi = null;
        G.taxiCooldown = 8;
      }
    }
  }
}
