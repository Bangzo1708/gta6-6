// Deterministic screenshot scenes (?shot=...). Each scene rebuilds the world
// from the variant seed, then stages one moment: a chase, a street on foot, a
// shootout, or the title screen. The game itself is unchanged — shots only
// move the player, spawn cars and set the wanted level before the first frame.
import { makeCar, makePolice } from './entities.js';
import { makeEnemy } from './combat.js';

function placePlayerInCar(G, x, y, angle, type, color) {
  const car = makeCar(x, y, angle, type, color);
  car.driver = 'player';
  car.speed = 320;
  G.cars.push(car);
  G.player.car = car;
  G.player.onFoot = false;
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
  return car;
}

function addPoliceChase(G, x, y, n, angle) {
  for (let i = 0; i < n; i++) {
    const c = makePolice(x - i * 95, y + (i % 2 === 0 ? 34 : -34) + i * 8, angle);
    c.speed = 300;
    G.police.push(c);
  }
}

function addTrafficRow(G, axisY, xs) {
  for (const x of xs) {
    const car = makeCar(x, axisY, 0, 'sedan', ['#d94f3d', '#3d7dd9', '#e8c33d'][xs.indexOf(x) % 3]);
    car.driver = 'traffic';
    car.axis = 'h';
    car.line = axisY;
    car.dir = 1;
    car.speed = 140;
    G.cars.push(car);
  }
}

export function applyShot(G, shot) {
  const city = G.city;
  const p = G.player;
  const garage = city.landmarks.garage;
  const mall = city.landmarks.mall;
  const pier = city.landmarks.pier;

  if (shot === 'menu') {
    // Title screen over a live city: camera over the boulevard.
    p.x = 1400;
    p.y = 1400;
    G.state = 'menu';
    return;
  }

  // Every gameplay shot starts the game (no menu); each scene below stages
  // its own mission, so the banner and the beacon match what is on screen.
  // Mission progress is frozen during a shot so the banner never flips mid-frame.
  G.state = 'playing';
  G.shotFreeze = true;

  if (shot === 'cover') {
    // The money shot: the hero cruises east down the beach boulevard in a red
    // sports car, three stars, police fanned out behind, traffic ahead, the
    // mission beacon glowing down the road and the sea on the right.
    const y = 1400; // Coral Ave
    const car = placePlayerInCar(G, 2380, y, 0, 'sport', '#d94f3d');
    car.speed = 240;
    G.coverCruise = { speed: 240, angle: 0 };
    addPoliceChase(G, 2180, y, 3, 0);
    addTrafficRow(G, y - 62, [2620, 2780, 2940]);
    addTrafficRow(G, y + 62, [2700, 2860]);
    G.wanted = 3;
    G.cash = 2450;
    G.clock = G.variant.light === 'night' ? 22 * 60 + 35 : 17 * 60 + 50;
    // A synthetic mission whose beacon sits ahead on the same road, clear of
    // the hero car so the car itself stays visible.
    G.mission.active = {
      def: {
        title: 'Ocean Drive Getaway',
        steps: [{ type: 'goto', x: 3120, y, label: 'Escape down Ocean Drive — lose the cops' }],
      },
      stepIndex: 0, kills: 0, timer: 0, pickupAt: null,
    };
    return;
  }

  if (shot === 'street') {
    // On foot at a busy intersection: a stealable sports car parked beside the
    // hero, peds crossing, traffic rolling past, the beacon down the block.
    p.x = 1400;
    p.y = 1400;
    p.onFoot = true;
    p.angle = 0;
    const parked = makeCar(1452, 1368, 0, 'sport', '#d94f3d');
    parked.driver = 'parked';
    G.cars.push(parked);
    addTrafficRow(G, 1400 - 62, [1560, 1720]);
    addTrafficRow(G, 1400 + 62, [1500, 1680]);
    const taxi = makeCar(1620, 1400 - 62, 0, 'taxi', '#f2c230');
    taxi.driver = 'traffic';
    taxi.axis = 'h';
    taxi.line = 1400 - 62;
    taxi.dir = 1;
    taxi.speed = 120;
    G.cars.push(taxi);
    G.mission.active = {
      def: {
        title: 'First Fare',
        steps: [{ type: 'goto', x: 1780, y: 1400, label: 'Meet the passenger down Coral Ave' }],
      },
      stepIndex: 0, kills: 0, timer: 0, pickupAt: null,
    };
    G.cash = 850;
    G.clock = G.variant.light === 'night' ? 21 * 60 + 20 : 10 * 60 + 15;
    G.camera.x = 1300;
    G.camera.y = 1180;
    return;
  }

  if (shot === 'combat') {
    // Shootout outside the mall, staged on the vault job: hero on foot, guards
    // close in, two stars, a cruiser arriving, live fire (the game plays
    // itself — see G.combatStrobe in main.js).
    p.x = mall.cx - 120;
    p.y = mall.cy + 110;
    p.onFoot = true;
    p.angle = 0.3;
    p.health = 72;
    const def = G.mission.chain[5]; // the mall vault finale
    G.mission.active = { def, stepIndex: 0, kills: 0, timer: 0, pickupAt: null };
    for (let i = 0; i < 5; i++) {
      const e = makeEnemy(mall.cx + 30 + i * 38, mall.cy + 80 + (i % 2) * 60, G.rng);
      G.enemies.push(e);
    }
    G.wanted = 2;
    const cop = makePolice(mall.cx - 260, mall.cy + 60, 0);
    cop.speed = 260;
    G.police.push(cop);
    G.combatStrobe = true;
    G.cash = 1320;
    G.clock = G.variant.light === 'night' ? 23 * 60 + 5 : 15 * 60 + 40;
    G.camera.x = mall.cx - 320;
    G.camera.y = mall.cy - 110;
    return;
  }

  // Default: plain gameplay from the garage.
  p.x = garage.cx;
  p.y = garage.cy + 90;
}
