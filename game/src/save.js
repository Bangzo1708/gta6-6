// Save / load through localStorage: cash, missions done, packages found, the
// player's position and the in-game clock. Autosaves after every mission; the
// pause menu saves on demand.
import { TUNE } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      v: 1,
      variant: G.variant.id,
      cash: G.cash,
      missionsDone: G.mission.index,
      packagesTaken: G.packages.filter((p) => p.taken).length,
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      clock: Math.round(G.clock),
      stats: G.stats,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(TUNE.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(TUNE.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(G, save) {
  G.cash = save.cash;
  G.mission.index = Math.min(save.missionsDone, G.mission.chain.length);
  G.clock = save.clock;
  G.stats = { ...G.stats, ...(save.stats || {}) };
  G.player.x = save.x;
  G.player.y = save.y;
  // Packages already collected stay collected.
  const taken = new Set();
  let n = 0;
  for (const pk of G.packages) {
    if (n < save.packagesTaken) { pk.taken = true; n += 1; }
    taken.add(pk);
  }
  void taken;
}
