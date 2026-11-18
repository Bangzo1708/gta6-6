// HUD: cash, health, wanted stars, clock, mission banner, contextual prompts,
// message feed, minimap, and the menu / pause / busted / wasted screens. All
// drawn on the same canvas as the game, so the screenshots carry the whole UI.
import { CITY, ROAD_AXES, ROAD_W } from './config.js';
import { currentStep } from './missions.js';

function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawHUD(G, ctx, W, H) {
  const p = G.player;
  const v = G.variant;

  // ---- top-left: cash + health --------------------------------------------
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  roundRect(ctx, 14, 14, 210, 64, 10);
  ctx.fillStyle = 'rgba(10,12,20,0.62)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('$' + G.cash.toLocaleString('en-US'), 28, 44);
  ctx.fillStyle = '#9fe8a9';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(v.hero.toUpperCase() + '  •  ' + v.name, 28, 64);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, 28, 86, 150, 10, 5);
  ctx.fill();
  ctx.fillStyle = p.health > 30 ? '#57d977' : '#ff5a5a';
  roundRect(ctx, 28, 86, 150 * Math.max(0, p.health / 100), 10, 5);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('HEALTH ' + Math.ceil(p.health), 186, 95);
  ctx.restore();

  // ---- top-right: wanted stars + clock --------------------------------------
  ctx.save();
  ctx.textAlign = 'right';
  const flash = G.flashStars > 0 && Math.floor(G.time * 6) % 2 === 0;
  for (let i = 0; i < 5; i++) {
    const x = W - 30 - i * 30;
    const y = 40;
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillStyle = i < G.wanted ? (flash ? '#ffffff' : '#ffd21f') : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', x, y);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(fmtClock(G.clock), W - 24, 74);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(G.wanted > 0 ? 'WANTED — LOSE THE COPS' : v.name + ' • FREE ROAM', W - 24, 94);
  ctx.restore();

  // ---- top-centre: mission banner --------------------------------------------
  const step = currentStep(G);
  if (step) {
    ctx.save();
    ctx.textAlign = 'center';
    const label = step.label;
    const dist = step.x !== undefined ? Math.round(Math.hypot(p.x - step.x, p.y - step.y)) + 'm' : '';
    const title = G.mission.active.def.title;
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = Math.max(320, ctx.measureText(label).width + 90);
    roundRect(ctx, W / 2 - w / 2, 12, w, 52, 10);
    ctx.fillStyle = 'rgba(10,12,20,0.62)';
    ctx.fill();
    ctx.fillStyle = v.accent;
    ctx.fillText('◆ ' + title.toUpperCase(), W / 2, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(label + (dist ? '  •  ' + dist : ''), W / 2, 52);
    if (step.time) {
      const left = Math.max(0, step.time - G.mission.active.timer);
      ctx.fillStyle = left < 15 ? '#ff5a5a' : '#ffd21f';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText('⏱ ' + Math.ceil(left) + 's', W / 2 + w / 2 + 34, 34);
    }
    ctx.restore();
  } else if (G.mission.index < G.mission.chain.length) {
    ctx.save();
    ctx.textAlign = 'center';
    roundRect(ctx, W / 2 - 190, 12, 380, 40, 10);
    ctx.fillStyle = 'rgba(10,12,20,0.62)';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('Press ENTER for the next mission: ' + G.mission.chain[G.mission.index].title, W / 2, 38);
    ctx.restore();
  }

  // ---- bottom-left: context + speed -------------------------------------------
  ctx.save();
  ctx.textAlign = 'left';
  let y = H - 22;
  if (!p.onFoot && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(kmh, 24, H - 52);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('km/h  •  ' + (p.car.type === 'sport' ? 'SPORTS CAR' : p.car.type.toUpperCase()), 78, H - 52);
    ctx.fillText('E exit  •  Space handbrake', 24, H - 24);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('LMB shoot  •  Shift run  •  M mute  •  Esc pause', 24, H - 24);
    const prompt = G.stealPromptText;
    if (prompt) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = '#ffd21f';
      ctx.fillText(prompt, 24, H - 48);
    }
  }
  ctx.restore();

  // ---- message feed -------------------------------------------------------------
  ctx.save();
  ctx.textAlign = 'left';
  let my = H - 190;
  for (const m of G.messages.slice(-4)) {
    ctx.globalAlpha = Math.min(1, m.life);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = m.color || '#ffffff';
    ctx.fillText(m.text, 24, my);
    my += 20;
  }
  ctx.restore();

  drawMinimap(G, ctx, W, H);
}

function drawMinimap(G, ctx, W, H) {
  const size = 196;
  const x0 = W - size - 16;
  const y0 = H - size - 16;
  const s = size / CITY;
  ctx.save();
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 12);
  ctx.fillStyle = 'rgba(10,12,20,0.66)';
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, x0, y0, size, size, 8);
  ctx.clip();
  // Ground + water + beach.
  ctx.fillStyle = G.variant.palette.ground;
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = G.variant.palette.water;
  ctx.fillRect(x0 + (CITY - 60) * s, y0, 60 * s, size);
  ctx.fillStyle = G.variant.palette.sand;
  ctx.fillRect(x0 + (CITY - 190) * s, y0, 130 * s, size);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(2, ROAD_W * s);
  for (const a of ROAD_AXES) {
    ctx.beginPath(); ctx.moveTo(x0 + a * s, y0); ctx.lineTo(x0 + a * s, y0 + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 + a * s); ctx.lineTo(x0 + size, y0 + a * s); ctx.stroke();
  }
  // Landmarks.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const l of Object.values(G.city.landmarks)) {
    ctx.fillRect(x0 + l.x0 * s, y0 + l.y0 * s, (l.x1 - l.x0) * s, (l.y1 - l.y0) * s);
  }
  // Packages.
  ctx.fillStyle = '#ffd21f';
  for (const pk of G.packages) {
    if (pk.taken) continue;
    ctx.fillRect(x0 + pk.x * s - 1.5, y0 + pk.y * s - 1.5, 3, 3);
  }
  // Taxi passenger.
  if (G.taxi) {
    const t = G.taxi.state === 'waiting' ? G.taxi.pickup : G.taxi.dest;
    ctx.fillStyle = '#57d977';
    ctx.beginPath();
    ctx.arc(x0 + t.x * s, y0 + t.y * s, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  for (const c of G.police) {
    ctx.fillStyle = Math.floor(G.time * 4) % 2 === 0 ? '#4f8dff' : '#ff4f4f';
    ctx.beginPath();
    ctx.arc(x0 + c.x * s, y0 + c.y * s, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker: pulsing diamond.
  const marker = G.missionMarkerPos;
  if (marker) {
    const pulse = 4 + Math.sin(G.time * 5) * 1.5;
    ctx.fillStyle = '#ffd21f';
    ctx.save();
    ctx.translate(x0 + marker.x * s, y0 + marker.y * s);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
    ctx.restore();
  }
  // Player arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(x0 + p.x * s, y0 + p.y * s);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // North + border.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', x0 + size - 14, y0 + 14);
  ctx.restore();
}

// ---- full-screen states ---------------------------------------------------------

export function drawMenu(G, ctx, W, H) {
  const v = G.variant;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = v.accent;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('A  S U N - S O A K E D   O P E N - W O R L D   C R I M E   G A M E', W / 2, H / 2 - 148);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 74px system-ui, sans-serif';
  ctx.fillText(v.name, W / 2, H / 2 - 78);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'italic 20px system-ui, sans-serif';
  ctx.fillText(v.tagline, W / 2, H / 2 - 44);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(v.hero + ' — ' + v.heroBio, W / 2, H / 2 - 12);
  ctx.fillStyle = v.accent;
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(G.save ? '▶  ENTER — Continue (save found)' : '▶  ENTER — New game', W / 2, H / 2 + 42);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '14px system-ui, sans-serif';
  const lines = [
    'WASD move / drive  •  E steal & enter cars  •  Mouse aim + click to shoot  •  Shift run',
    'Space handbrake  •  6 story missions  •  Taxi fares, hidden packages, stunt jumps',
    'Steal cars, dodge the law, build your wanted level — and lose the cops to keep the cash.',
    'M mute  •  Esc pause  •  Progress saves automatically after every mission.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 84 + i * 22));
  ctx.restore();
}

export function drawPaused(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Esc resume  •  S save now  •  Q quit to menu', W / 2, H / 2 + 18);
  ctx.fillText('Cash $' + G.cash.toLocaleString('en-US') + '  •  Missions ' + G.mission.index + '/' + G.mission.chain.length +
    '  •  Packages ' + (G.stats.packages || 0) + '/12  •  Cars stolen ' + (G.stats.carsStolen || 0), W / 2, H / 2 + 48);
  ctx.restore();
}

export function drawBusted(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,30,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#4f8dff';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('BUSTED', W / 2, H / 2 - 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('The Harbor PD caught up with you. Bail cost $' + G.bustedFine + ' — press ENTER to walk free.', W / 2, H / 2 + 28);
  ctx.restore();
}

export function drawWasted(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(20,8,8,0.8)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('WASTED', W / 2, H / 2 - 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('You woke up at Solmar General. Hospital bill $' + G.wastedFine + ' — press ENTER to get back out there.', W / 2, H / 2 + 28);
  ctx.restore();
}
