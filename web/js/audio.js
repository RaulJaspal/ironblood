// WebAudio: synthesized impact SFX + dark ambient combat loop. No audio files.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.enabled = true;
    this.musicPlaying = false;
  }

  ensure() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
  }

  resume() { this.ensure(); if (this.ctx.state === 'suspended') this.ctx.resume(); }

  noiseBuffer(dur = 0.5) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate * dur, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  play(name, opts = {}) {
    if (!this.enabled) return;
    this.ensure();
    const t = this.ctx.currentTime;
    const fn = this['sfx_' + name];
    if (fn) fn.call(this, t, opts);
  }

  env(node, t, attack, decay, peak = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g);
    g.connect(this.master);
    return g;
  }

  thump(t, freq = 85, decay = 0.22, peak = 0.9) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    this.env(o, t, 0.005, decay, peak);
    o.start(t); o.stop(t + decay + 0.1);
  }

  noiseHit(t, { cutoff = 1800, q = 1.2, decay = 0.15, peak = 0.7, type = 'bandpass' } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(decay + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = cutoff; f.Q.value = q;
    src.connect(f);
    this.env(f, t, 0.004, decay, peak);
    src.start(t); src.stop(t + decay + 0.1);
  }

  sfx_punch1(t) { this.thump(t, 95, 0.16, 0.7); this.noiseHit(t, { cutoff: 1500, decay: 0.1, peak: 0.5 }); }
  sfx_punch2(t) { this.thump(t, 80, 0.22, 0.9); this.noiseHit(t, { cutoff: 1100, decay: 0.14, peak: 0.65 }); }
  sfx_punch3(t) { this.thump(t, 65, 0.3, 1.0); this.noiseHit(t, { cutoff: 900, decay: 0.2, peak: 0.8 }); }
  sfx_kick1(t) { this.thump(t, 110, 0.18, 0.75); this.noiseHit(t, { cutoff: 2400, decay: 0.12, peak: 0.5 }); }
  sfx_kick2(t) { this.thump(t, 70, 0.28, 1.0); this.noiseHit(t, { cutoff: 1800, decay: 0.18, peak: 0.7 }); }
  sfx_block(t) { this.noiseHit(t, { cutoff: 3200, q: 3, decay: 0.08, peak: 0.4 }); this.thump(t, 140, 0.08, 0.3); }
  sfx_whoosh(t) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.3);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.18);
    src.connect(f);
    this.env(f, t, 0.02, 0.22, 0.25);
    src.start(t); src.stop(t + 0.35);
  }
  sfx_fire(t) {
    const o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth';
    o1.frequency.setValueAtTime(220, t); o2.frequency.setValueAtTime(227, t);
    o1.frequency.exponentialRampToValueAtTime(440, t + 0.3);
    o2.frequency.exponentialRampToValueAtTime(452, t + 0.3);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    o1.connect(f); o2.connect(f);
    this.env(f, t, 0.03, 0.4, 0.3);
    o1.start(t); o2.start(t); o1.stop(t + 0.5); o2.stop(t + 0.5);
    this.noiseHit(t, { cutoff: 2000, decay: 0.3, peak: 0.2 });
  }
  sfx_charge(t) { this.sfx_whoosh(t); this.thump(t + 0.1, 60, 0.3, 0.8); }
  sfx_super(t) {
    this.thump(t, 55, 0.5, 1.0);
    this.noiseHit(t, { cutoff: 800, decay: 0.4, peak: 0.8, type: 'lowpass' });
    for (let i = 0; i < 3; i++) this.thump(t + 0.15 * i, 70 - i * 8, 0.25, 0.8);
  }
  sfx_ko(t) {
    this.thump(t, 45, 0.9, 1.2);
    this.noiseHit(t, { cutoff: 600, decay: 0.8, peak: 0.9, type: 'lowpass' });
  }
  sfx_launch(t) { this.sfx_whoosh(t); this.thump(t, 75, 0.25, 0.8); }
  sfx_land(t) { this.noiseHit(t, { cutoff: 500, decay: 0.15, peak: 0.4, type: 'lowpass' }); }
  sfx_select(t) { this.noiseHit(t, { cutoff: 2600, q: 8, decay: 0.07, peak: 0.3 }); this.thump(t, 200, 0.08, 0.25); }
  sfx_confirm(t) { this.thump(t, 160, 0.15, 0.4); this.thump(t + 0.08, 220, 0.2, 0.4); }
  sfx_round(t) { this.thump(t, 50, 0.7, 0.9); this.noiseHit(t, { cutoff: 900, decay: 0.5, peak: 0.4, type: 'lowpass' }); }

  // dark 2-bar loop: sub bass pulse + minor arp + noise hats
  startMusic() {
    if (!this.enabled || this.musicPlaying) return;
    this.ensure();
    this.musicPlaying = true;
    const bpm = 92, beat = 60 / bpm, bar = beat * 4;
    const root = 41.2; // E1
    const minor = [1, 1.189, 1.498, 2, 2.378, 2.996];
    let nextBar = this.ctx.currentTime + 0.1;

    const scheduleBar = (t) => {
      if (!this.musicPlaying) return;
      // sub pulse on each beat
      for (let b = 0; b < 4; b++) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = root * (b === 2 ? 0.749 : 1);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + b * beat);
        g.gain.exponentialRampToValueAtTime(0.5, t + b * beat + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + b * beat + beat * 0.85);
        o.connect(g); g.connect(this.musicGain);
        o.start(t + b * beat); o.stop(t + (b + 1) * beat);
      }
      // sparse arp
      for (let s = 0; s < 8; s++) {
        if (Math.random() < 0.45) continue;
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = root * 4 * minor[Math.floor(Math.random() * minor.length)];
        const g = this.ctx.createGain();
        const st = t + s * beat * 0.5;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.12, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.3);
        o.connect(g); g.connect(this.musicGain);
        o.start(st); o.stop(st + 0.4);
      }
      // hats
      for (let s = 0; s < 8; s++) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer(0.05);
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass'; f.frequency.value = 8000;
        const g = this.ctx.createGain();
        g.gain.value = s % 2 ? 0.03 : 0.06;
        src.connect(f); f.connect(g); g.connect(this.musicGain);
        src.start(t + s * beat * 0.5);
      }
      nextBar = t + bar;
      setTimeout(() => scheduleBar(nextBar), (nextBar - this.ctx.currentTime - 0.15) * 1000);
    };
    scheduleBar(nextBar);
  }

  stopMusic() { this.musicPlaying = false; }
  setMusicVolume(v) { if (this.musicGain) this.musicGain.gain.value = v; }
}
