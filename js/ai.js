// CPU opponent: distance-bucket state machine with reaction delays.
import { STATE } from './fighter.js';
import { FIGHT } from './config.js';

export class AI {
  constructor(fighter, difficulty = 3) {
    this.f = fighter;
    this.difficulty = difficulty; // 1..8
    this.nextThink = 0;
    this.held = { left: false, right: false, down: false };
    this.plan = null;
    this.planUntil = 0;
  }

  think(now) {
    const f = this.f, op = f.opponent;
    const d = this.difficulty;
    const dist = Math.abs(op.x - f.x);
    const toward = op.x > f.x ? 'right' : 'left';
    const away = op.x > f.x ? 'left' : 'right';
    const r = Math.random;

    this.held = { left: false, right: false, down: false };
    const acts = [];

    // panic block: opponent attacking in range
    const danger = op.state === STATE.ATTACK && dist < 2.0;
    const blockChance = 0.15 + d * 0.09;
    if (danger && r() < blockChance) {
      this.held[away] = true;
      if (op.move && op.move.height === 'low') this.held.down = true;
      return acts;
    }

    // anti-air
    if (op.y > 0.5 && dist < 2.2 && r() < 0.25 + d * 0.06) {
      acts.push(f.kit.s2 === 'uppercut' ? 's2' : 'hp');
      return acts;
    }

    // punish knockdown recovery timing: back off slightly
    if ([STATE.DOWN, STATE.LAUNCHED].includes(op.state)) {
      if (dist < 1.4) this.held[away] = true;
      else this.held[toward] = dist > 2.2;
      return acts;
    }

    if (dist > 3.4) {
      const roll = r();
      if (roll < 0.3 + d * 0.03) acts.push('s1'); // projectile
      else if (roll < 0.75) this.held[toward] = true;
      else if (roll < 0.85) acts.push('dash_toward');
      else acts.push('jump');
    } else if (dist > 1.9) {
      const roll = r();
      if (roll < 0.42) this.held[toward] = true;
      else if (roll < 0.55) acts.push('dash_toward');
      else if (roll < 0.68) acts.push('hk');
      else if (roll < 0.78) acts.push('lk');
      else if (roll < 0.86) this.held[away] = true;
      else acts.push('s1');
    } else {
      // close range
      const roll = r();
      if (f.meter >= FIGHT.maxMeter && roll < 0.35) acts.push('super');
      else if (roll < 0.3) { acts.push('lp'); this.queue = ['lp', 'hp']; }
      else if (roll < 0.5) { acts.push('hp'); this.queue = ['hp', 'hp', 'hp']; }
      else if (roll < 0.62) acts.push('lk');
      else if (roll < 0.72) { this.held.down = true; acts.push('lk'); } // sweep
      else if (roll < 0.82) acts.push('s2');
      else if (roll < 0.9) this.held[away] = true;
      else acts.push('hk');
    }
    return acts;
  }

  update(now) {
    const d = this.difficulty;
    const acts = [];
    if (now >= this.nextThink) {
      const thought = this.think(now);
      acts.push(...thought);
      // reaction cadence: harder = faster
      this.nextThink = now + (0.42 - d * 0.035) + Math.random() * 0.25;
    }
    // continue chain queue
    if (this.queue && this.queue.length && this.f.chainWindow > 0) {
      acts.push(this.queue.shift());
    }
    return { held: this.held, actions: acts };
  }
}
