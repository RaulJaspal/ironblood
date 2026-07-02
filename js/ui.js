// Fight HUD + banners. Screen flow lives in main.js; this drives in-fight DOM.
export class UI {
  constructor() {
    this.hud = document.getElementById('hud');
    this.bannerEl = document.getElementById('banner');
    this.timerEl = document.getElementById('timer');
    this.bars = null;
    this.bannerTimeout = null;
  }

  setupHUD(f1, f2) {
    document.getElementById('p1-name').textContent = f1.cfg.name;
    document.getElementById('p2-name').textContent = f2.cfg.name;
    document.getElementById('p1-portrait').style.backgroundImage = `url(assets/portraits/${f1.cfg.id}.png)`;
    document.getElementById('p2-portrait').style.backgroundImage = `url(assets/portraits/${f2.cfg.id}.png)`;
    this.updateHealth(f1, f2, true);
    this.updateMeters(f1, f2);
    this.updateRounds(f1, f2);
    this.hud.classList.remove('hidden');
  }

  hideHUD() { this.hud.classList.add('hidden'); }

  updateHealth(f1, f2, snap = false) {
    for (const [f, side] of [[f1, 'p1'], [f2, 'p2']]) {
      const pct = Math.max(0, f.health / f.maxHealth) * 100;
      const bar = document.getElementById(`${side}-health`);
      const ghost = document.getElementById(`${side}-ghost`);
      bar.style.width = pct + '%';
      if (snap) ghost.style.width = pct + '%';
      else {
        clearTimeout(f._ghostT);
        f._ghostT = setTimeout(() => { ghost.style.width = pct + '%'; }, 450);
      }
    }
  }

  updateMeters(f1, f2) {
    for (const [f, side] of [[f1, 'p1'], [f2, 'p2']]) {
      const pct = (f.meter / 100) * 100;
      const el = document.getElementById(`${side}-meter`);
      el.style.width = pct + '%';
      el.classList.toggle('full', f.meter >= 100);
    }
  }

  updateRounds(f1, f2) {
    for (const [f, side] of [[f1, 'p1'], [f2, 'p2']]) {
      const pips = document.querySelectorAll(`#${side}-rounds .pip`);
      pips.forEach((p, i) => p.classList.toggle('won', i < f.roundsWon));
    }
  }

  updateTimer(t) {
    this.timerEl.textContent = String(Math.ceil(t)).padStart(2, '0');
  }

  banner(text, ms = 1200, kind = 'round') {
    clearTimeout(this.bannerTimeout);
    this.bannerEl.textContent = text;
    this.bannerEl.className = `banner show ${kind}`;
    this.bannerTimeout = setTimeout(() => {
      this.bannerEl.className = 'banner';
    }, ms);
  }

  showCombo(fighter) {
    const side = fighter.side === 1 ? 'p1' : 'p2';
    const el = document.getElementById(`${side}-combo`);
    el.textContent = `${fighter.combo} HITS`;
    el.classList.add('show');
    el.style.animation = 'none';
    void el.offsetWidth; // restart pop animation
    el.style.animation = '';
  }

  hideCombo(fighter) {
    const side = fighter.side === 1 ? 'p1' : 'p2';
    document.getElementById(`${side}-combo`).classList.remove('show');
  }
}
