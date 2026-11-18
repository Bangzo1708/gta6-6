// World rendering: the city, its cars and people, the light of each variant,
// and every effect (skids, muzzle flashes, explosions, rain, sirens). Drawn on
// one 2D canvas, culled to the camera view, so it stays fast in headless Chrome.
import { CITY, ROAD_AXES, ROAD_W } from './config.js';
import { CAR_TYPES } from './entities.js';

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(G, ctx, W, H) {
  const cam = G.camera;
  const v = G.variant;
  const pal = v.palette;
  const zoom = cam.zoom;
  const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + W / zoom, vy1 = cam.y + H / zoom;
  const inView = (x, y, m = 80) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x + (G.shakeX || 0), -cam.y + (G.shakeY || 0));

  // ---- ground ----------------------------------------------------------------
  ctx.fillStyle = pal.ground;
  ctx.fillRect(vx0 - 20, vy0 - 20, vx1 - vx0 + 40, vy1 - vy0 + 40);

  // ---- beach + water -----------------------------------------------------------
  const beach = G.city.beach;
  ctx.fillStyle = pal.sand;
  ctx.fillRect(beach.x0, Math.max(0, vy0), beach.x1 - beach.x0, Math.min(CITY, vy1) - Math.max(0, vy0));
  ctx.fillStyle = pal.water;
  ctx.fillRect(beach.waterX0, Math.max(0, vy0), CITY - beach.waterX0, Math.min(CITY, vy1) - Math.max(0, vy0));
  // Animated wave lines along the shore.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const wx = beach.waterX0 - 8 + i * 14;
    for (let y = Math.max(0, vy0); y < Math.min(CITY, vy1); y += 26) {
      const wob = Math.sin(y * 0.02 + G.time * 2 + i * 1.7) * 5;
      if (y === Math.max(0, vy0)) ctx.moveTo(wx + wob, y);
      else ctx.lineTo(wx + wob, y);
    }
    ctx.stroke();
  }

  // ---- parks ---------------------------------------------------------------------
  for (const park of G.city.parks) {
    if (!inView(park.cx, park.cy, 200)) continue;
    ctx.fillStyle = pal.grass;
    ctx.fillRect(park.x0, park.y0, park.x1 - park.x0, park.y1 - park.y0);
    if (park.pond) {
      ctx.fillStyle = pal.water;
      ctx.beginPath();
      ctx.ellipse(park.cx, park.cy, 42, 26, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const t of park.trees) drawTree(ctx, t.x, t.y, t.r, pal, v);
  }

  // ---- parking lots ----------------------------------------------------------------
  for (const lot of G.city.parkingLots) {
    if (!inView(lot.cx, lot.cy, 200)) continue;
    ctx.fillStyle = shade(pal.road, 1.05);
    ctx.fillRect(lot.x0, lot.y0, lot.x1 - lot.x0, lot.y1 - lot.y0);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    for (let x = lot.x0 + 24; x < lot.x1 - 10; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, lot.y0 + 10); ctx.lineTo(x, lot.y0 + 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, lot.y1 - 10); ctx.lineTo(x, lot.y1 - 34); ctx.stroke();
    }
  }

  // ---- roads -----------------------------------------------------------------------
  ctx.fillStyle = pal.road;
  for (const a of ROAD_AXES) {
    if (a > vx0 - ROAD_W && a < vx1 + ROAD_W) {
      ctx.fillRect(a - ROAD_W / 2, Math.max(0, vy0), ROAD_W, Math.min(CITY, vy1) - Math.max(0, vy0));
      ctx.fillRect(Math.max(0, vx0), a - ROAD_W / 2, Math.min(CITY, vx1) - Math.max(0, vx0), ROAD_W);
    }
  }
  // Sidewalk edges.
  ctx.strokeStyle = pal.sidewalk;
  ctx.lineWidth = 10;
  for (const a of ROAD_AXES) {
    for (const off of [-ROAD_W / 2 - 5, ROAD_W / 2 + 5]) {
      if (a + off > vx0 && a + off < vx1) {
        ctx.beginPath(); ctx.moveTo(a + off, Math.max(0, vy0)); ctx.lineTo(a + off, Math.min(CITY, vy1)); ctx.stroke();
      }
      if (a + off > vy0 && a + off < vy1) {
        ctx.beginPath(); ctx.moveTo(Math.max(0, vx0), a + off); ctx.lineTo(Math.min(CITY, vx1), a + off); ctx.stroke();
      }
    }
  }
  // Dashed centre lines.
  ctx.strokeStyle = pal.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const a of ROAD_AXES) {
    if (a > vx0 && a < vx1) {
      ctx.beginPath(); ctx.moveTo(a, Math.max(0, vy0)); ctx.lineTo(a, Math.min(CITY, vy1)); ctx.stroke();
    }
    if (a > vy0 && a < vy1) {
      ctx.beginPath(); ctx.moveTo(Math.max(0, vx0), a); ctx.lineTo(Math.min(CITY, vx1), a); ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const ax of ROAD_AXES) {
    for (const ay of ROAD_AXES) {
      if (!inView(ax, ay, 120)) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax + i * 13 - 4, ay - ROAD_W / 2 + 6, 8, 14);
        ctx.fillRect(ax + i * 13 - 4, ay + ROAD_W / 2 - 20, 8, 14);
      }
    }
  }

  // ---- buildings --------------------------------------------------------------------
  const angled = v.camera === 'angled';
  const sunX = v.light === 'golden' ? 0.55 : 0.3;
  const sunY = v.light === 'golden' ? 0.75 : 0.35;
  for (const b of G.city.buildings) {
    if (!inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) continue;
    const h = angled ? b.height : 6;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + h * sunX, b.y + h * sunY, b.w, b.h);
    if (angled) {
      // Extruded walls: the roof sits up-left of the base.
      const ox = -h * 0.45;
      const oy = -h * 0.6;
      ctx.fillStyle = shade(b.color, 0.55);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.h);
      ctx.lineTo(b.x + ox, b.y + b.h + oy);
      ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade(b.color, 0.75);
      ctx.beginPath();
      ctx.moveTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w + ox, b.y + oy);
      ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy);
      ctx.lineTo(b.x + b.w, b.y + b.h);
      ctx.closePath();
      ctx.fill();
      drawRoof(ctx, b.x + ox, b.y + oy, b.w, b.h, b, pal);
    } else {
      drawRoof(ctx, b.x, b.y, b.w, b.h, b, pal);
    }
    if (b.label) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      const ly = angled ? b.y - b.height * 0.6 - 8 : b.y - 8;
      const tw = ctx.measureText(b.label.toUpperCase()).width;
      ctx.fillStyle = 'rgba(10,12,20,0.72)';
      roundRectPath(ctx, b.x + b.w / 2 - tw / 2 - 8, ly - 14, tw + 16, 19, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(b.label.toUpperCase(), b.x + b.w / 2, ly);
      ctx.textAlign = 'left';
    }
  }

  // ---- skid marks ----------------------------------------------------------------------
  for (const s of G.skids) {
    if (!inView(s.x, s.y, 40)) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(0.5, s.life / 5);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
    ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
    ctx.stroke();
    ctx.restore();
  }

  // ---- packages -------------------------------------------------------------------------
  for (const pk of G.packages) {
    if (pk.taken || !inView(pk.x, pk.y, 40)) continue;
    const glow = 10 + Math.sin(G.time * 4 + pk.x) * 3;
    ctx.fillStyle = 'rgba(255,210,31,0.35)';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, glow + 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd21f';
    ctx.fillRect(pk.x - 6, pk.y - 5, 12, 10);
    ctx.fillStyle = '#8a6d00';
    ctx.fillRect(pk.x - 6, pk.y - 1, 12, 2);
  }

  // ---- mission / taxi markers --------------------------------------------------------------
  const marker = G.missionMarkerPos;
  if (marker && inView(marker.x, marker.y, 200)) drawBeacon(ctx, marker.x, marker.y, '#ffd21f', G.time);
  if (G.taxi) {
    const t = G.taxi.state === 'waiting' ? G.taxi.pickup : G.taxi.dest;
    if (inView(t.x, t.y, 200)) drawBeacon(ctx, t.x, t.y, '#57d977', G.time + 2);
  }

  // ---- pedestrians --------------------------------------------------------------------------
  for (const ped of G.peds) {
    if (!inView(ped.x, ped.y, 30)) continue;
    drawPerson(ctx, ped, G.time);
  }
  for (const e of G.enemies) {
    if (!inView(e.x, e.y, 30)) continue;
    drawPerson(ctx, e, G.time, true);
  }

  // ---- cars ------------------------------------------------------------------------------------
  const allCars = [...G.cars, ...G.police];
  for (const car of allCars) {
    if (!inView(car.x, car.y, 60)) continue;
    drawCar(ctx, car, G, v);
  }

  // ---- player -----------------------------------------------------------------------------------
  drawPlayer(ctx, G);

  // ---- bullets -----------------------------------------------------------------------------------
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ---- particles ----------------------------------------------------------------------------------
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ---- muzzle flashes -------------------------------------------------------------------------------
  if (G.muzzle > 0) {
    const p = G.player;
    ctx.fillStyle = 'rgba(255,220,120,0.9)';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (G.muzzleEnemy && G.muzzleEnemy.t > 0) {
    ctx.fillStyle = 'rgba(255,180,90,0.85)';
    ctx.beginPath();
    ctx.arc(G.muzzleEnemy.x, G.muzzleEnemy.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- night / golden light ---------------------------------------------------------------------------
  if (v.light === 'night') {
    ctx.fillStyle = 'rgba(8,10,28,0.52)';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    ctx.globalCompositeOperation = 'lighter';
    // Lamp glow at intersections + headlight pools around cars.
    for (const ax of ROAD_AXES) {
      for (const ay of ROAD_AXES) {
        if (!inView(ax, ay, 160)) continue;
        const g = ctx.createRadialGradient(ax, ay, 4, ax, ay, 130);
        g.addColorStop(0, 'rgba(255,180,120,0.20)');
        g.addColorStop(1, 'rgba(255,180,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ax, ay, 130, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const car of allCars) {
      if (!inView(car.x, car.y, 160)) continue;
      const hx = car.x + Math.cos(car.angle) * 30;
      const hy = car.y + Math.sin(car.angle) * 30;
      const g = ctx.createRadialGradient(hx, hy, 4, hx, hy, 90);
      g.addColorStop(0, 'rgba(255,240,180,0.28)');
      g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(hx, hy, 90, 0, Math.PI * 2); ctx.fill();
    }
    const p = G.player;
    const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 190);
    g.addColorStop(0, 'rgba(255,220,160,0.22)');
    g.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, 190, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  } else if (v.light === 'golden') {
    ctx.fillStyle = 'rgba(255,140,50,0.10)';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  } else {
    ctx.fillStyle = 'rgba(255,230,160,0.05)';
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  }

  // ---- rain (neon) --------------------------------------------------------------------------------------
  if (v.rain) {
    ctx.strokeStyle = 'rgba(180,200,255,0.28)';
    ctx.lineWidth = 1;
    const seed = Math.floor(G.time * 40);
    for (let i = 0; i < 90; i++) {
      const rx = vx0 + ((i * 137 + seed * 7) % (vx1 - vx0));
      const ry = vy0 + ((i * 89 + seed * 13) % (vy1 - vy0));
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 6, ry + 16);
      ctx.stroke();
    }
  }

  // ---- damage vignette + low-health pulse ------------------------------------------------------------------
  const p = G.player;
  if (p.health < 100) {
    const a = (1 - p.health / 100) * 0.35 * (0.7 + 0.3 * Math.sin(G.time * 6));
    const g = ctx.createRadialGradient(
      cam.x + (W / zoom) / 2, cam.y + (H / zoom) / 2, (W / zoom) * 0.28,
      cam.x + (W / zoom) / 2, cam.y + (H / zoom) / 2, (W / zoom) * 0.62,
    );
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, 'rgba(255,0,0,' + a + ')');
    ctx.fillStyle = g;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  }

  ctx.restore();
}

function drawTree(ctx, x, y, r, pal, v) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 4, y + 5, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pal.parkTree;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = shade(pal.parkTree, 1.3);
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.55, 0, Math.PI * 2); ctx.fill();
  if (v.light === 'night') {
    ctx.fillStyle = 'rgba(255,157,226,0.5)';
    ctx.beginPath(); ctx.arc(x + r * 0.4, y + r * 0.2, 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawRoof(ctx, x, y, w, h, b, pal) {
  ctx.fillStyle = b.color;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // Roof furniture.
  if (b.roof === 'ac') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(x + w * 0.2, y + h * 0.25, 14, 10);
    ctx.fillRect(x + w * 0.6, y + h * 0.55, 14, 10);
  } else if (b.roof === 'pool') {
    ctx.fillStyle = '#4fb3d9';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.min(26, w * 0.3), Math.min(16, h * 0.3), 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();
  } else if (b.roof === 'garden') {
    ctx.fillStyle = pal.parkTree;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + w * (0.25 + i * 0.25), y + h * (0.35 + (i % 2) * 0.25), 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (b.roof === 'landmark') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + 8, y + 8, w - 16, 6);
  }
}

function drawBeacon(ctx, x, y, color, t) {
  const pulse = 1 + Math.sin(t * 5) * 0.15;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.arc(x, y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(x, y - 26 - Math.sin(t * 3) * 6);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.strokeRect(-9, -9, 18, 18);
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 22 * pulse, 0, Math.PI * 2); ctx.stroke();
}

function drawPerson(ctx, ped, t, isEnemy = false) {
  const bob = Math.sin(ped.walkPhase) * 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(ped.x, ped.y + bob * 0.3);
  ctx.rotate(ped.angle);
  // Body.
  ctx.fillStyle = ped.color;
  roundRectPath(ctx, -6, -8, 14, 16, 5);
  ctx.fill();
  // Head.
  ctx.fillStyle = ped.skin;
  ctx.beginPath(); ctx.arc(8, 0, 6, 0, Math.PI * 2); ctx.fill();
  if (isEnemy) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(24, 0); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (!p.onFoot) return;
  const bob = p.speed > 0 ? Math.sin(G.time * (p.run ? 16 : 11)) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  ctx.rotate(p.angle);
  // Bright jacket so the hero reads at a glance.
  ctx.fillStyle = '#ff7a1a';
  roundRectPath(ctx, -7, -9, 16, 18, 6);
  ctx.fill();
  ctx.fillStyle = '#20242e';
  ctx.fillRect(-7, -9, 4, 18);
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(9, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  // Pistol.
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(26, 2); ctx.stroke();
  ctx.restore();
  // Aim line, subtle.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
  ctx.lineTo(p.x + Math.cos(p.angle) * 90, p.y + Math.sin(p.angle) * 90);
  ctx.stroke();
}

function drawCar(ctx, car, G, v) {
  const type = CAR_TYPES[car.type] || CAR_TYPES.sedan;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRectPath(ctx, -car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRectPath(ctx, -car.w / 2, -car.h / 2, car.w, car.h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Windshield + roof + rear window.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(car.w * 0.18, -car.h / 2 + 3, 8, car.h - 6);
  ctx.fillStyle = shade(car.color, 0.72);
  ctx.fillRect(-car.w * 0.08, -car.h / 2 + 4, car.w * 0.22, car.h - 8);
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(-car.w * 0.32, -car.h / 2 + 3, 7, car.h - 6);
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-2, -car.h / 2 - 3, 12, 6);
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 6px system-ui, sans-serif';
    ctx.fillText('TAXI', -1, -car.h / 2 + 2);
  }
  if (car.type === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-car.w * 0.08, -car.h / 2 + 4, car.w * 0.22, car.h - 8);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.fillText('PD', -car.w * 0.05, 2);
    // Flashing light bar.
    const phase = Math.floor(car.sirenPhase) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2e2e' : '#2e6bff';
    ctx.beginPath(); ctx.arc(0, -car.h / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = phase ? '#2e6bff' : '#ff2e2e';
    ctx.beginPath(); ctx.arc(0, car.h / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Headlights + taillights.
  ctx.fillStyle = v.light === 'night' ? '#fff3b0' : 'rgba(255,243,176,0.9)';
  ctx.fillRect(car.w / 2 - 2, -car.h / 2 + 3, 3, 4);
  ctx.fillRect(car.w / 2 - 2, car.h / 2 - 7, 3, 4);
  ctx.fillStyle = '#ff2e2e';
  ctx.fillRect(-car.w / 2 - 1, -car.h / 2 + 3, 3, 4);
  ctx.fillRect(-car.w / 2 - 1, car.h / 2 - 7, 3, 4);
  ctx.restore();
  // Smoke when wrecked / badly damaged.
  if (car.health < 40 && car.driver !== 'parked') {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath();
    ctx.arc(car.x + Math.sin(G.time * 3) * 6, car.y - 10, 8 + Math.sin(G.time * 5) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
