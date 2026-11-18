// Entry point: wires the city, the entities, the missions, the HUD and the
// renderer into one game loop, and owns the state machine (menu / playing /
// paused / busted / wasted), the camera, the message feed and the particles.
import { CITY, TUNE, VARIANTS, variantFromQuery } from './config.js';
import { buildCity } from './city.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import {
  makePlayer, spawnTraffic, spawnPeds, spawnParkedCars,
  updatePlayer, updateTraffic, updatePeds, updatePolice, stealPrompt, commitCrime,
} from './entities.js';
import { playerShoot, updateBullets, updateEnemies } from './combat.js';
import {
  makeMissionState, startNextMission, updateMissions, missionMarker,
  spawnPackages, updateSideActivities,
} from './missions.js';
import { drawWorld } from './render.js';
import { drawHUD, drawMenu, drawPaused, drawBusted, drawWasted } from './hud.js';
import { saveGame, loadSave, applySave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const variantId = variantFromQuery(window.location.search);
const variant = VARIANTS[variantId];

const city = buildCity(variant);
const sounds = new SoundBank();
const input = new Input(canvas);

const G = {
  variant, city, sounds,
  rng: city.rng,
  state: 'menu',
  time: 0, // seconds since boot, drives animation
  clock: variant.clockStart, // in-game minutes
  cash: 250,
  wanted: 0,
  wantedTimer: 0,
  flashStars: 0,
  gunshotTimer: 0,
  muzzle: 0,
  muzzleEnemy: null,
  shake: 0, shakeX: 0, shakeY: 0,
  spawnCooldown: 0,
  taxiCooldown: 6,
  taxi: null,
  packages: [],
  cars: [],
  peds: [],
  police: [],
  enemies: [],
  bullets: [],
  particles: [],
  skids: [],
  messages: [],
  stats: { kills: 0, carsStolen: 0, missionsDone: 0, packages: 0, fares: 0, crimes: 0 },
  camera: { x: 1200, y: 1200, zoom: 1 },
  cameraFrozen: false,
  busted: false, wasted: false,
  bustedFine: 0, wastedFine: 0,
  save: null,
  missionMarkerPos: null,
  stealPromptText: null,
  addMessage(text, color) {
    this.messages.push({ text, color: color || '#ffffff', life: 1 });
    if (this.messages.length > 6) this.messages.shift();
  },
  addParticles(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(40, 260);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: this.rng.range(0.3, 0.9), maxLife: 0.9, r: this.rng.range(2, 5), color,
      });
    }
  },
  saveGame() { return saveGame(this); },
};

G.player = makePlayer(city.landmarks.garage.cx, city.landmarks.garage.cy + 90);
G.mission = makeMissionState(G);
spawnTraffic(G, 16);
spawnPeds(G, 30);
spawnParkedCars(G);
spawnPackages(G);

// A save is offered on the menu (Continue); screenshot scenes never load one.
if (!shot) {
  const save = loadSave();
  if (save && save.variant === variantId) G.save = save;
}

if (shot) applyShot(G, shot);

window.__game = G; // playtest handle

// ---- state transitions ---------------------------------------------------------

function startGame(useSave) {
  sounds.ensure();
  if (useSave && G.save) {
    applySave(G, G.save);
    G.addMessage('Welcome back, ' + variant.hero + '.', '#9fe8a9');
  } else {
    G.addMessage(variant.hero + ' is back in town. Press ENTER to start your first mission.', '#ffd98a');
  }
  G.state = 'playing';
  sounds.startMusic(variant);
}

function respawnAt(key) {
  const l = city.landmarks[key];
  const p = G.player;
  if (p.car) { p.car.driver = 'parked'; p.car = null; }
  p.onFoot = true;
  p.x = l.cx;
  p.y = l.cy + 80;
  p.health = 100;
  p.bustedTimer = 0;
  G.wanted = 0;
  G.wantedTimer = 0;
  G.police = [];
  G.enemies = [];
  G.bullets = [];
  G.busted = false;
  G.wasted = false;
  G.state = 'playing';
  G.camera.x = p.x - canvas.width / 2;
  G.camera.y = p.y - canvas.height / 2;
  G.saveGame();
}

function handleEnter() {
  if (G.state === 'menu') startGame(!!G.save);
  else if (G.state === 'busted') respawnAt('police');
  else if (G.state === 'wasted') respawnAt('hospital');
  else if (G.state === 'playing' && !G.mission.active && G.mission.index < G.mission.chain.length) {
    startNextMission(G);
  }
}

// ---- per-frame update ------------------------------------------------------------

function update(dt) {
  G.time += dt;
  G.clock += dt * 0.5; // one game minute every 2 seconds
  G.flashStars = Math.max(0, G.flashStars - dt);
  G.gunshotTimer = Math.max(0, G.gunshotTimer - dt);
  G.muzzle = Math.max(0, G.muzzle - dt);
  if (G.muzzleEnemy) {
    G.muzzleEnemy.t -= dt;
    if (G.muzzleEnemy.t <= 0) G.muzzleEnemy = null;
  }
  for (const m of G.messages) m.life -= dt * 0.22;
  G.messages = G.messages.filter((m) => m.life > 0);
  for (const pt of G.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  for (const s of G.skids) s.life -= dt;
  G.skids = G.skids.filter((s) => s.life > 0);

  // Camera shake.
  if (G.shake > 0) {
    G.shake -= dt;
    G.shakeX = (G.rng.next() - 0.5) * G.shake * 22;
    G.shakeY = (G.rng.next() - 0.5) * G.shake * 22;
  } else {
    G.shakeX = 0;
    G.shakeY = 0;
  }

  // Enter works in every state: start from the menu, retry a mission, walk
  // free after busted/wasted. It must be checked before the playing-only
  // section below returns early.
  if (input.wasPressed('Enter')) handleEnter();
  if (G.state !== 'playing') return;

  // Input: mute + pause.
  if (input.wasPressed('KeyM')) {
    sounds.setMuted(!sounds.muted);
    G.addMessage(sounds.muted ? 'Sound off' : 'Sound on', '#ffffff');
  }
  if (input.wasPressed('Escape')) {
    G.state = 'paused';
    return;
  }

  updatePlayer(G, dt, input);
  if (input.mouseDown) playerShoot(G);
  // Screenshot scenes: the cover cruises on its own, the combat scene plays
  // itself (aim at the nearest enemy and fire) — real gameplay, no fakery.
  if (G.coverCruise && !G.player.onFoot && G.player.car) {
    G.player.car.speed = G.coverCruise.speed;
    G.player.car.angle = G.coverCruise.angle;
  }
  if (G.combatStrobe) {
    G.strobeTimer = (G.strobeTimer || 0) - dt;
    if (G.strobeTimer <= 0) {
      G.strobeTimer = 0.38;
      let best = null;
      let bd = Infinity;
      for (const e of G.enemies) {
        if (e.state === 'dead') continue;
        const d = Math.hypot(e.x - G.player.x, e.y - G.player.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        G.player.angle = Math.atan2(best.y - G.player.y, best.x - G.player.x);
        playerShoot(G);
      }
    }
  }
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateEnemies(G, dt);
  if (!G.shotFreeze) updateMissions(G, dt);
  updateSideActivities(G, dt);

  // Engine hum follows the driven car.
  const speedRatio = !G.player.onFoot && G.player.car
    ? Math.abs(G.player.car.speed) / (TUNE.carTopSpeed * 1.25)
    : 0;
  sounds.engine(speedRatio);

  // Busted / wasted transitions.
  if (G.busted) {
    G.bustedFine = Math.min(G.cash, 150 + G.wanted * 50);
    G.cash -= G.bustedFine;
    sounds.busted();
    sounds.siren(false);
    G.state = 'busted';
    return;
  }
  if (G.wasted) {
    G.wastedFine = Math.min(G.cash, 200);
    G.cash -= G.wastedFine;
    sounds.siren(false);
    G.state = 'wasted';
    return;
  }

  // Per-frame HUD inputs.
  G.missionMarkerPos = missionMarker(G);
  G.stealPromptText = stealPrompt(G);

  // Camera follows the player.
  if (!G.cameraFrozen) {
    const vw = canvas.width / G.camera.zoom;
    const vh = canvas.height / G.camera.zoom;
    const tx = G.player.x - vw / 2;
    const ty = G.player.y - vh / 2;
    G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
    G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);
    G.camera.x = Math.max(-80, Math.min(CITY - vw + 80, G.camera.x));
    G.camera.y = Math.max(-80, Math.min(CITY - vh + 80, G.camera.y));
  }
  G.camera.zoom = Math.max(0.75, Math.min(1.25, canvas.width / 1280));
}

// ---- render ------------------------------------------------------------------------

function render() {
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (G.state === 'menu') {
    // Live city behind the title.
    const cx = 1400 + Math.sin(G.time * 0.05) * 160;
    const cy = 1400 + Math.cos(G.time * 0.04) * 120;
    G.camera.x = cx - W / 2;
    G.camera.y = cy - H / 2;
    drawWorld(G, ctx, W, H);
    drawMenu(G, ctx, W, H);
  } else {
    drawWorld(G, ctx, W, H);
    if (G.state === 'playing' || G.state === 'paused') drawHUD(G, ctx, W, H);
    if (G.state === 'paused') drawPaused(G, ctx, W, H);
    if (G.state === 'busted') drawBusted(G, ctx, W, H);
    if (G.state === 'wasted') drawWasted(G, ctx, W, H);
  }
}

// ---- main loop -----------------------------------------------------------------------

let last = performance.now();
let frames = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.state === 'paused') {
    if (input.wasPressed('Escape')) G.state = 'playing';
    if (input.wasPressed('KeyS')) { G.saveGame(); G.addMessage('Progress saved.', '#9fe8a9'); }
    if (input.wasPressed('KeyQ')) { G.state = 'menu'; G.saveGame(); }
  } else {
    update(dt);
  }
  render();
  input.endFrame();
  frames += 1;
  if (frames === 3) window.__ready = true;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// First-gesture audio unlock for clicks on the canvas.
canvas.addEventListener('pointerdown', () => sounds.ensure(), { once: true });
