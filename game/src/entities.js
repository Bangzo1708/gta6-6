// Everyone who lives in the city: the player (on foot or in a car), pedestrians,
// traffic cars, parked cars and the police. This file owns movement, collisions
// with buildings, car theft, and the wanted system.
import { CITY, ROAD_AXES, ROAD_W, TUNE } from './config.js';
import { clampToCity, isOnRoad, nearestRoadPoint, pointInBuilding, randomRoadPoint } from './city.js';

export const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33d', '#7d3dd9', '#3dd9a0', '#d9d9d9', '#2b2b2b', '#e07a2e'];
export const CAR_TYPES = {
  sedan: { w: 46, h: 22, accel: 1.0, top: 1.0, label: 'Sedan' },
  taxi: { w: 46, h: 22, accel: 1.0, top: 0.95, label: 'Taxi' },
  sport: { w: 48, h: 21, accel: 1.35, top: 1.22, label: 'Sports car' },
  truck: { w: 58, h: 26, accel: 0.75, top: 0.8, label: 'Truck' },
  van: { w: 52, h: 24, accel: 0.85, top: 0.85, label: 'Van' },
  police: { w: 48, h: 22, accel: 1.15, top: 1.08, label: 'Police cruiser' },
};

export function makeCar(x, y, angle, type, color) {
  const t = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    kind: 'car', x, y, angle, speed: 0, type, color,
    w: t.w, h: t.h, accel: t.accel, top: t.top,
    health: 100, driver: null, // 'player' | 'traffic' | 'police' | 'parked' | null
    sirenPhase: Math.random() * 6,
  };
}

export function makePlayer(x, y) {
  return {
    kind: 'player', x, y, angle: -Math.PI / 2, speed: 0,
    onFoot: true, car: null, health: TUNE.playerHealth,
    run: false, shootCooldown: 0, punchCooldown: 0, invuln: 0,
    bustedTimer: 0,
  };
}

export function makePed(x, y, rng) {
  return {
    kind: 'ped', x, y, angle: rng.range(0, Math.PI * 2), speed: 0,
    target: null, state: 'walk', // walk | flee | dead
    color: rng.pick(['#e86a6a', '#6aa5e8', '#e8c33d', '#7de86a', '#c96ae8', '#e8e8e8', '#2e8b6a']),
    skin: rng.pick(['#f2c89b', '#c98d5f', '#8a5a3b', '#e8b88a']),
    walkPhase: rng.range(0, 6), health: 50, fear: 0,
  };
}

export function makePolice(x, y, angle) {
  const car = makeCar(x, y, angle, 'police', '#20242e');
  car.driver = 'police';
  car.health = 120;
  return car;
}

// ---- spawning ---------------------------------------------------------------

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(G.city, G.rng);
    const type = G.rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'sport', 'truck', 'van']);
    const angle = p.vertical ? (G.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
      : (G.rng.chance(0.5) ? 0 : Math.PI);
    const car = makeCar(p.x, p.y, angle, type, type === 'taxi' ? '#f2c230' : G.rng.pick(CAR_COLORS));
    car.driver = 'traffic';
    car.axis = p.vertical ? 'v' : 'h';
    car.line = p.vertical ? p.x : p.y;
    car.dir = p.vertical ? Math.sign(Math.sin(angle)) : Math.sign(Math.cos(angle));
    car.speed = G.rng.range(110, 180);
    G.cars.push(car);
  }
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(G.city, G.rng);
    const ped = makePed(p.x + G.rng.range(-80, 80), p.y + G.rng.range(-80, 80), G.rng);
    G.peds.push(ped);
  }
}

export function spawnParkedCars(G) {
  for (const spot of G.city.parkedSpots) {
    const type = G.rng.pick(['sedan', 'sedan', 'sport', 'van', 'truck']);
    const car = makeCar(spot.x, spot.y, spot.angle, type, G.rng.pick(CAR_COLORS));
    car.driver = 'parked';
    G.cars.push(car);
  }
  // A few hero cars near landmarks, easy to steal.
  const garage = G.city.landmarks.garage;
  if (garage) {
    const sport = makeCar(garage.cx, garage.y1 + 70, 0, 'sport', '#d94f3d');
    sport.driver = 'parked';
    G.cars.push(sport);
  }
}

// ---- crime + wanted -----------------------------------------------------------

export function commitCrime(G, stars, reason) {
  const before = G.wanted;
  G.wanted = Math.min(5, G.wanted + stars);
  if (G.wanted > before) {
    G.wantedTimer = 0;
    G.flashStars = 1.2;
    if (reason) G.addMessage(reason + ' — wanted level ' + G.wanted, '#ff5a5a');
    G.sounds.sirenBlip();
  }
  G.stats.crimes = (G.stats.crimes || 0) + 1;
}

export function nearestPolice(G, x, y) {
  let best = null;
  let bd = Infinity;
  for (const c of G.police) {
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return { car: best, dist: bd };
}

function spawnPoliceCar(G) {
  // Spawn on a road a little way from the player, so the chase is visible.
  const p = G.player;
  for (let tries = 0; tries < 12; tries++) {
    const a = G.rng.range(0, Math.PI * 2);
    const d = G.rng.range(420, 700);
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    if (x < 60 || y < 60 || x > CITY - 60 || y > CITY - 60) continue;
    const rp = nearestRoadPoint(G.city, x, y);
    if (pointInBuilding(G.city, rp.x, rp.y, 24)) continue;
    const car = makePolice(rp.x, rp.y, Math.atan2(p.y - rp.y, p.x - rp.x));
    G.police.push(car);
    return car;
  }
  return null;
}

// ---- physics helpers ----------------------------------------------------------

function collideBuildings(G, obj, radius) {
  const b = pointInBuilding(G.city, obj.x, obj.y, radius * 0.4);
  if (!b) return false;
  // Push out along the smallest penetration axis.
  const cx = Math.max(b.x, Math.min(obj.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(obj.y, b.y + b.h));
  let dx = obj.x - cx;
  let dy = obj.y - cy;
  let d = Math.hypot(dx, dy);
  if (d < 0.01) { dx = 0; dy = -1; d = 1; }
  const push = radius - d + 1;
  obj.x += (dx / d) * push;
  obj.y += (dy / d) * push;
  return true;
}

function moveWithCollision(G, obj, nx, ny, radius) {
  obj.x = nx;
  obj.y = ny;
  if (collideBuildings(G, obj, radius)) return true;
  const c = clampToCity(obj.x, obj.y, 24);
  obj.x = c.x;
  obj.y = c.y;
  return false;
}

// ---- player -------------------------------------------------------------------

export function updatePlayer(G, dt, input) {
  const p = G.player;
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  if (p.onFoot) {
    const run = input.down('ShiftLeft', 'ShiftRight');
    const sp = run ? TUNE.playerRun : TUNE.playerWalk;
    let mx = input.moveX;
    let my = input.moveY;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      p.angle = Math.atan2(my, mx);
      moveWithCollision(G, p, p.x + mx * sp * dt, p.y + my * sp * dt, 13);
      p.speed = sp;
      p.run = run;
    } else {
      p.speed = 0;
      p.run = false;
    }
    // Aim with the mouse when shooting.
    if (input.mouseDown || p.shootCooldown > 0) {
      const wx = G.camera.x + input.mouseX / G.camera.zoom;
      const wy = G.camera.y + input.mouseY / G.camera.zoom;
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }
  } else if (p.car) {
    driveCar(G, p.car, input, dt, true);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    p.speed = Math.abs(p.car.speed);
  }

  // Enter / exit a car.
  if (input.wasPressed('KeyE')) {
    if (p.onFoot) tryEnterCar(G);
    else exitCar(G);
  }
}

function nearestStealableCar(G, maxDist = 64) {
  const p = G.player;
  let best = null;
  let bd = maxDist;
  for (const c of G.cars) {
    if (c.driver === 'player' || c.driver === 'police') continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function tryEnterCar(G) {
  const p = G.player;
  const car = nearestStealableCar(G);
  if (!car) return;
  if (car.driver === 'traffic') {
    // Yank the driver out: they become a fleeing pedestrian.
    const ped = makePed(car.x + 26, car.y + 26, G.rng);
    ped.state = 'flee';
    ped.fear = 1;
    G.peds.push(ped);
    commitCrime(G, 1, 'Car stolen');
    G.stats.carsStolen = (G.stats.carsStolen || 0) + 1;
  } else if (car.driver === 'parked') {
    commitCrime(G, 1, 'Car stolen');
    G.stats.carsStolen = (G.stats.carsStolen || 0) + 1;
  }
  car.driver = 'player';
  car.speed = 0;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  G.sounds.doorSlam();
  G.addMessage('Driving a ' + (CAR_TYPES[car.type].label) + ' — W/S drive, Space handbrake, E to get out', '#ffd98a');
}

function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = 'parked';
  car.speed = 0;
  const a = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(a) * 34;
  p.y = car.y + Math.sin(a) * 34;
  p.onFoot = true;
  p.car = null;
  G.sounds.doorSlam();
}

export function driveCar(G, car, input, dt, isPlayer) {
  const type = CAR_TYPES[car.type];
  const forward = input.down('KeyW', 'ArrowUp');
  const back = input.down('KeyS', 'ArrowDown');
  const steerL = input.down('KeyA', 'ArrowLeft');
  const steerR = input.down('KeyD', 'ArrowRight');
  const brake = input.down('Space');

  const top = TUNE.carTopSpeed * type.top;
  if (forward) car.speed += TUNE.carAccel * type.accel * dt;
  if (back) car.speed -= TUNE.carAccel * 0.7 * dt;
  if (!forward && !back) car.speed *= Math.pow(0.4, dt);
  if (brake) car.speed *= Math.pow(0.02, dt);
  car.speed = Math.max(-TUNE.carReverseTop, Math.min(top, car.speed));

  const steer = (steerR ? 1 : 0) - (steerL ? 1 : 0);
  const spd = Math.abs(car.speed);
  const grip = car.speed >= 0 ? 1 : -1;
  car.angle += steer * TUNE.carTurn * (spd / top) * grip * dt * (brake ? 1.6 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = moveWithCollision(G, car, nx, ny, 20);
  if (hit && spd > 240) {
    G.sounds.crash();
    car.speed *= 0.4;
    car.health -= 8;
    G.addParticles(car.x, car.y, 8, '#c9c9c9');
    if (isPlayer && car.health <= 0) wreckPlayerCar(G);
  }
  // Skid marks + dust at speed.
  if (spd > 300 && (brake || Math.abs(steer) > 0) && G.rng.chance(0.5)) {
    G.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 5 });
  }
}

function wreckPlayerCar(G) {
  const p = G.player;
  const car = p.car;
  G.addParticles(car.x, car.y, 40, '#ff7a1a');
  G.addParticles(car.x, car.y, 24, '#3a3a3a');
  G.sounds.crash();
  car.driver = 'wreck';
  p.car = null;
  p.onFoot = true;
  p.x = car.x + 40;
  p.y = car.y + 40;
  p.health = Math.max(20, p.health - 25);
  G.addMessage('Your car is wrecked!', '#ff5a5a');
  G.shake = 0.5;
}

// ---- traffic -------------------------------------------------------------------

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    // Car ahead? Slow down.
    let blocked = false;
    for (const other of G.cars) {
      if (other === car || other.driver === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 78 && side < 26) { blocked = true; break; }
    }
    const target = blocked ? 0 : TUNE.trafficSpeed;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    // Steer along the road axis.
    const wantAngle = car.axis === 'v'
      ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.dir > 0 ? 0 : Math.PI);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    // Lane offset: drive on the right side of the centre-line.
    const lane = 20;
    if (car.axis === 'v') {
      const wantX = car.line + (car.dir > 0 ? lane : -lane);
      car.x += (wantX - car.x) * Math.min(1, dt * 3);
    } else {
      const wantY = car.line + (car.dir > 0 ? -lane : lane);
      car.y += (wantY - car.y) * Math.min(1, dt * 3);
    }
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Gentle separation so traffic never visibly overlaps at intersections.
    for (const other of G.cars) {
      if (other === car || other.driver === 'parked') continue;
      const ox = car.x - other.x;
      const oy = car.y - other.y;
      const od = Math.hypot(ox, oy);
      if (od > 0.01 && od < 50) {
        car.x += (ox / od) * (50 - od) * 0.4;
        car.y += (oy / od) * (50 - od) * 0.4;
      }
    }
    const c = clampToCity(car.x, car.y, 40);
    car.x = c.x;
    car.y = c.y;
    // At an intersection, maybe turn.
    if (Math.abs(car.x - nearestAxisOf(car, 'x')) < 6 || Math.abs(car.y - nearestAxisOf(car, 'y')) < 6) {
      // handled below by axis proximity check
    }
    const onV = Math.min(...ROAD_AXES.map((a) => Math.abs(car.x - a))) < 8;
    const onH = Math.min(...ROAD_AXES.map((a) => Math.abs(car.y - a))) < 8;
    if (onV && onH && G.rng.chance(dt * 0.9)) {
      // Turn onto the crossing road.
      if (car.axis === 'v') {
        car.axis = 'h';
        car.line = nearestAxisOf(car, 'y');
        car.dir = G.rng.chance(0.5) ? 1 : -1;
      } else {
        car.axis = 'v';
        car.line = nearestAxisOf(car, 'x');
        car.dir = G.rng.chance(0.5) ? 1 : -1;
      }
    }
    // Despawn far-away traffic, respawn near the player to keep the city alive.
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d > 1500) {
      const rp = randomRoadPoint(G.city, G.rng);
      const near = { x: p.x + (rp.x - p.x) * 0.2, y: p.y + (rp.y - p.y) * 0.2 };
      const snapped = nearestRoadPoint(G.city, near.x, near.y);
      car.x = snapped.x;
      car.y = snapped.y;
      car.axis = snapped.vertical ? 'v' : 'h';
      car.line = snapped.vertical ? snapped.x : snapped.y;
      car.dir = G.rng.chance(0.5) ? 1 : -1;
    }
  }
}

function nearestAxisOf(car, which) {
  const v = which === 'x' ? car.x : car.y;
  let best = ROAD_AXES[0];
  let bd = Infinity;
  for (const a of ROAD_AXES) {
    const d = Math.abs(v - a);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

// ---- pedestrians -----------------------------------------------------------------

export function updatePeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.state === 'dead') continue;
    // Fear: gunfire, explosions or a speeding car nearby.
    const dp = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (G.gunshotTimer > 0 && dp < 420) ped.fear = 1;
    if (!p.onFoot && p.car && Math.abs(p.car.speed) > 300 && dp < 130) ped.fear = 1;
    if (ped.fear > 0) {
      ped.state = 'flee';
      ped.fear = Math.max(0, ped.fear - dt * 0.25);
    } else if (ped.state === 'flee') {
      ped.state = 'walk';
    }
    if (ped.state === 'flee') {
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.angle = a;
      const sp = 240;
      moveWithCollision(G, ped, ped.x + Math.cos(a) * sp * dt, ped.y + Math.sin(a) * sp * dt, 10);
      ped.walkPhase += dt * 14;
    } else {
      if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 14) {
        // New sidewalk waypoint: a point near a road.
        const rp = randomRoadPoint(G.city, G.rng);
        ped.target = { x: rp.x + G.rng.range(-90, 90), y: rp.y + G.rng.range(-90, 90) };
      }
      const a = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
      ped.angle = a;
      const sp = 62;
      moveWithCollision(G, ped, ped.x + Math.cos(a) * sp * dt, ped.y + Math.sin(a) * sp * dt, 10);
      ped.walkPhase += dt * 8;
    }
    // Keep pedestrians from standing inside each other.
    for (const other of G.peds) {
      if (other === ped || other.state === 'dead') continue;
      const ox = ped.x - other.x;
      const oy = ped.y - other.y;
      const od = Math.hypot(ox, oy);
      if (od > 0.01 && od < 18) {
        ped.x += (ox / od) * (18 - od) * 0.5;
        ped.y += (oy / od) * (18 - od) * 0.5;
      }
    }
    // Run over by a car? That's a crime.
    if (!p.onFoot && p.car && Math.abs(p.car.speed) > 120) {
      const d = Math.hypot(ped.x - p.car.x, ped.y - p.car.y);
      if (d < 26) {
        ped.state = 'dead';
        commitCrime(G, 1, 'Pedestrian down');
        G.addParticles(ped.x, ped.y, 10, '#c94f4f');
        G.stats.kills = (G.stats.kills || 0) + 1;
      }
    }
  }
  // Prune the dead after a while; keep the city populated.
  G.peds = G.peds.filter((pd) => pd.state !== 'dead' || (pd.deadTimer = (pd.deadTimer || 0) + dt) < 6);
  if (G.peds.length < 26) spawnPeds(G, 4);
  if (G.cars.filter((c) => c.driver === 'traffic').length < 14) spawnTraffic(G, 3);
}

// ---- police ------------------------------------------------------------------------

export function updatePolice(G, dt) {
  const p = G.player;
  const want = G.wanted;
  const targetCount = want === 0 ? 0 : Math.min(5, want + (want >= 3 ? 1 : 0));
  // Spawn / despawn to match the wanted level.
  if (G.police.length < targetCount && G.spawnCooldown <= 0) {
    spawnPoliceCar(G);
    G.spawnCooldown = 1.2;
  }
  G.spawnCooldown = Math.max(0, (G.spawnCooldown || 0) - dt);
  if (want === 0 && G.police.length > 0) {
    // Cops give up and drive off.
    G.police = G.police.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) < 900);
  }

  for (let ci = 0; ci < G.police.length; ci++) {
    const car = G.police[ci];
    car.sirenPhase += dt * 6;
    // Each cruiser aims at its own flank point around the player, so the pack
    // fans out instead of piling onto one spot.
    const flank = (ci / Math.max(1, G.police.length)) * Math.PI * 2 + ci * 0.7;
    const tx = p.x + Math.cos(flank) * 110;
    const ty = p.y + Math.sin(flank) * 110;
    const dx = tx - car.x;
    const dy = ty - car.y;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const top = TUNE.policeTopSpeed * (0.9 + want * 0.04);
    car.speed = Math.min(top, car.speed + TUNE.carAccel * dt);
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff * 2.4));
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const hit = moveWithCollision(G, car, nx, ny, 20);
    if (hit) car.speed *= 0.5;
    // Keep cruisers from stacking: push apart when two get too close.
    for (const other of G.police) {
      if (other === car) continue;
      const ox = car.x - other.x;
      const oy = car.y - other.y;
      const od = Math.hypot(ox, oy);
      if (od > 0.01 && od < 58) {
        car.x += (ox / od) * (58 - od) * 0.5;
        car.y += (oy / od) * (58 - od) * 0.5;
      }
    }
    const dist = Math.hypot(p.x - car.x, p.y - car.y);
    // Ram the player.
    if (dist < 52) {
      if (p.onFoot) {
        p.bustedTimer += dt;
        if (p.bustedTimer > TUNE.bustedHoldSeconds) {
          G.busted = true;
          return;
        }
      } else if (p.car) {
        p.car.health -= TUNE.policeRam * dt;
        p.car.speed *= 0.92;
        if (G.rng.chance(dt * 2)) G.sounds.crash();
        if (p.car.health <= 0) wreckPlayerCar(G);
      }
    } else if (p.onFoot) {
      p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
    }
  }

  // Wanted decay: no cop in sight for a while.
  if (want > 0) {
    const near = nearestPolice(G, p.x, p.y);
    if (near.dist > 700) {
      G.wantedTimer += dt;
      if (G.wantedTimer > TUNE.starDecaySeconds) {
        G.wanted -= 1;
        G.wantedTimer = 0;
        G.addMessage('Wanted level dropped to ' + G.wanted, '#9fe8a9');
      }
    } else {
      G.wantedTimer = 0;
    }
  }
  G.sounds.siren(want > 0);
}

// The closest car the player could steal, for the HUD prompt.
export function stealPrompt(G) {
  if (!G.player.onFoot) return null;
  const car = nearestStealableCar(G, 70);
  return car ? 'E — steal ' + CAR_TYPES[car.type].label : null;
}
