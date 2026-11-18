// Synthesised sound: no audio files, everything is WebAudio oscillators and
// filtered noise, so the game stays a handful of static files. Music is a small
// step-sequenced bass + pad loop that changes with the variant (day / night /
// golden hour each get their own key and tempo).
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.step = 0;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  shoot() { this._noise(0.12, 0.5, 3200); this._tone(190, 0.09, 'square', 0.18, 60); }
  punch() { this._noise(0.08, 0.35, 900); }
  pickup() { this._tone(660, 0.09, 'sine', 0.3); this._tone(990, 0.14, 'sine', 0.3); }
  cash() { this._tone(880, 0.08, 'triangle', 0.3); setTimeout(() => this._tone(1320, 0.16, 'triangle', 0.3), 90); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 'triangle', 0.32), i * 110));
  }
  missionFail() { this._tone(220, 0.5, 'sawtooth', 0.22, 110); }
  crash() { this._noise(0.3, 0.6, 700); }
  sirenBlip() { this._tone(980, 0.16, 'square', 0.12, 1240); }
  doorSlam() { this._noise(0.1, 0.4, 500); this._tone(90, 0.1, 'sine', 0.4, 50); }
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this._tone(f, 0.3, 'sawtooth', 0.2), i * 160)); }

  // Engine hum follows the driven car's speed; call every frame.
  engine(speedRatio) {
    if (!this.ctx || this.muted) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      this.engineOsc.connect(f).connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, t, 0.05);
    this.engineGain.gain.setTargetAtTime(speedRatio > 0.02 ? 0.05 + speedRatio * 0.05 : 0, t, 0.08);
  }

  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 800;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this._sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null;
      this._sirenLfo = null;
    }
  }

  // Tiny step sequencer: root notes per variant, hats on the off-beat.
  startMusic(variant) {
    if (!this.ctx || this.musicTimer) return;
    const roots = { solmar: [110, 98, 87, 98], neon: [82.4, 98, 110, 98], palma: [98, 87.3, 110, 123.5] }[variant.id];
    const bpm = variant.id === 'neon' ? 112 : 96;
    const stepDur = 60 / bpm / 2;
    this.step = 0;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const s = this.step++;
      const bar = Math.floor(s / 8) % 4;
      if (s % 2 === 0) this._tone(roots[bar], stepDur * 1.8, 'triangle', 0.16);
      if (s % 8 === 6) this._tone(roots[bar] * 1.5, stepDur, 'sine', 0.1);
      if (s % 2 === 1) this._noise(0.03, 0.05, 6000);
      if (s % 16 === 0) this._tone(roots[bar] * 4, stepDur * 3, 'sine', 0.045);
    }, stepDur * 1000);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
