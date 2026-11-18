// Combat: the player's pistol, bullets, armed enemies and their simple AI.
// Enemies stand their ground and shoot back; killing one drops cash.
import { TUNE } from './config.js';
import { commitCrime, makePed } from './entities.js';

export function makeEnemy(x, y, rng) {
  const ped = makePed(x, y, rng);
  ped.kind = 'enemy';
  ped.state = 'combat';
  ped.health = 60;
  ped.color = '#3a3a3a';
  ped.shootCooldown = rng.range(0.4, 1.2);
  ped.aggro = 520;
  return ped;
}

export function playerShoot(G) {
  const p = G.player;
  if (p.shootCooldown > 0 || !p.onFoot) return;
  p.shootCooldown = TUNE.pistolRate;
  G.bullets.push({
    x: p.x + Math.cos(p.angle) * 20,
    y: p.y + Math.sin(p.angle) * 20,
    vx: Math.cos(p.angle) * TUNE.bulletSpeed,
    vy: Math.sin(p.angle) * TUNE.bulletSpeed,
    life: 1.1, from: 'player', damage: TUNE.pistolDamage,
  });
  G.gunshotTimer = 0.6;
  G.sounds.shoot();
  G.muzzle = 0.07;
  // Firing near the law draws attention.
  const near = G.police.length > 0 && G.police.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 500);
  if (near && G.wanted < 2) commitCrime(G, 1, 'Shots fired near police');
}

export function updateBullets(G, dt) {
  const p = G.player;
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    // Hit a building?
    if (G.city && pointInBuildingHit(G, b.x, b.y)) {
      b.life = 0;
      G.addParticles(b.x, b.y, 4, '#c9c9c9');
      continue;
    }
    if (b.from === 'player') {
      // Hit an enemy or a pedestrian?
      for (const e of G.enemies) {
        if (e.state === 'dead') continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          b.life = 0;
          e.health -= b.damage;
          G.addParticles(b.x, b.y, 6, '#ff6a5a');
          if (e.health <= 0) {
            e.state = 'dead';
            G.cash += 25;
            G.stats.kills = (G.stats.kills || 0) + 1;
            G.addMessage('Enemy down — +$25', '#ffd98a');
            G.sounds.cash();
          }
          break;
        }
      }
      if (b.life > 0) {
        for (const ped of G.peds) {
          if (ped.state === 'dead') continue;
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
            b.life = 0;
            ped.state = 'dead';
            commitCrime(G, 1, 'Pedestrian shot');
            G.addParticles(b.x, b.y, 8, '#c94f4f');
            G.stats.kills = (G.stats.kills || 0) + 1;
            break;
          }
        }
      }
      // Hit a police car?
      if (b.life > 0) {
        for (const c of G.police) {
          if (Math.hypot(c.x - b.x, c.y - b.y) < 26) {
            b.life = 0;
            c.health -= b.damage;
            G.addParticles(b.x, b.y, 6, '#ffcf5a');
            if (c.health <= 0) {
              G.addParticles(c.x, c.y, 40, '#ff7a1a');
              G.police = G.police.filter((x) => x !== c);
              commitCrime(G, 2, 'Officer down');
              G.stats.kills = (G.stats.kills || 0) + 1;
            }
            break;
          }
        }
      }
    } else {
      // Enemy bullet: hit the player?
      if (p.onFoot && Math.hypot(p.x - b.x, p.y - b.y) < 15 && p.invuln <= 0) {
        b.life = 0;
        damagePlayer(G, b.damage);
      } else if (!p.onFoot && p.car && Math.hypot(p.car.x - b.x, p.car.y - b.y) < 26) {
        b.life = 0;
        p.car.health -= b.damage * 0.5;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

function pointInBuildingHit(G, x, y) {
  for (const b of G.city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.invuln > 0) return;
  p.health -= amount;
  p.invuln = 0.35;
  G.shake = Math.max(G.shake, 0.25);
  G.sounds.punch();
  if (p.health <= 0) {
    p.health = 0;
    G.wasted = true;
  }
}

export function updateEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.state === 'dead') continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.shootCooldown -= dt;
    if (d < e.aggro) {
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      // Strafe closer when far, hold position when near.
      if (d > 220) {
        e.x += Math.cos(e.angle) * 90 * dt;
        e.y += Math.sin(e.angle) * 90 * dt;
      }
      if (e.shootCooldown <= 0 && d < 460) {
        e.shootCooldown = 0.85 + G.rng.next() * 0.7;
        const spread = (G.rng.next() - 0.5) * 0.22;
        const a = e.angle + spread;
        G.bullets.push({
          x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20,
          vx: Math.cos(a) * (TUNE.bulletSpeed * 0.8), vy: Math.sin(a) * (TUNE.bulletSpeed * 0.8),
          life: 1.1, from: 'enemy', damage: TUNE.enemyDamage,
        });
        G.muzzleEnemy = { x: e.x, y: e.y, t: 0.07 };
        G.sounds.shoot();
      }
    }
    e.walkPhase += dt * 6;
  }
  G.enemies = G.enemies.filter((e) => e.state !== 'dead' || (e.deadTimer = (e.deadTimer || 0) + dt) < 5);
}
