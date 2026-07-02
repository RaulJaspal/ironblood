// FightSession: orchestrates one match (rounds, camera, hit-stop, timers).
import * as THREE from 'three';
import { Fighter, STATE } from './fighter.js';
import { Combat } from './combat.js';
import { AI } from './ai.js';
import { FIGHT } from './config.js';

const PHASE = { INTRO: 'intro', FIGHT: 'fight', ROUND_END: 'round_end', MATCH_END: 'match_end' };

export class FightSession {
  // mode: 'arcade' | 'versus'; p1/p2: roster cfgs
  constructor({ scene, camera, fx, audio, ui, input, p1, p2, mode, difficulty = 3 }) {
    Object.assign(this, { scene, camera, fx, audio, ui, input, mode });
    this.f1 = new Fighter(p1, 1);
    this.f2 = new Fighter(p2, -1);
    this.f1.opponent = this.f2;
    this.f2.opponent = this.f1;
    if (mode === 'arcade') this.cpu = new AI(this.f2, difficulty);
    this.combat = new Combat(scene, fx, audio);
    this.round = 1;
    this.phase = PHASE.INTRO;
    this.phaseTime = 0;
    this.timer = FIGHT.roundTime;
    this.timeScale = 1;
    this.hitStopUntil = 0;
    this.slowmoUntil = 0;
    this.now = 0;
    this.paused = false;
    this.onMatchEnd = null;
    this.camTarget = new THREE.Vector3();
    this.camPos = new THREE.Vector3(0, 1.4, 4.6);
    this.introStep = -1;
  }

  async load() {
    await Promise.all([this.f1.load(), this.f2.load()]);
    this.scene.add(this.f1.root, this.f2.root);
    this.ui.setupHUD(this.f1, this.f2);
    this.startRound();
  }

  startRound() {
    this.f1.resetForRound(1);
    this.f2.resetForRound(-1);
    this.combat.clearProjectiles();
    this.timer = FIGHT.roundTime;
    this.phase = PHASE.INTRO;
    this.phaseTime = 0;
    this.introStep = -1;
    this.ui.updateHealth(this.f1, this.f2, true);
    this.ui.updateMeters(this.f1, this.f2);
    this.ui.updateRounds(this.f1, this.f2);
    this.ui.updateTimer(this.timer);
  }

  destroy() {
    this.scene.remove(this.f1.root, this.f2.root);
    this.combat.clearProjectiles();
  }

  routeInput(fighter, playerIdx, dt) {
    let held, actions;
    if (playerIdx === 1 && this.cpu) {
      if (this.phase !== PHASE.FIGHT) { return; }
      const out = this.cpu.update(this.now);
      held = out.held;
      actions = out.actions;
    } else {
      held = this.input.held(playerIdx);
      actions = this.input.drainActions(playerIdx);
    }
    if (this.phase !== PHASE.FIGHT) return;

    fighter.inputHeld = held;
    for (const a of actions) {
      switch (a) {
        case 'lp': fighter.tryAttack(held.down ? 'jab' : 'jab', this.now); break;
        case 'hp': fighter.tryAttack('cross', this.now); break;
        case 'lk': fighter.tryAttack(held.down ? 'sweep' : 'kick_front', this.now); break;
        case 'hk': fighter.tryAttack(held.down ? 'sweep' : 'kick_round', this.now); break;
        case 's1': fighter.tryAttack(fighter.kit.s1, this.now); break;
        case 's2': fighter.tryAttack(fighter.kit.s2, this.now); break;
        case 'super': fighter.tryAttack('super', this.now); break;
        case 'jump': fighter.tryJump((held.right ? 1 : 0) - (held.left ? 1 : 0), this.now); break;
        case 'dash_left': fighter.tryDash(-1, this.now); break;
        case 'dash_right': fighter.tryDash(1, this.now); break;
        case 'dash_toward': fighter.tryDash(fighter.facing, this.now); break;
        default: break;
      }
    }
  }

  update(rawDt) {
    if (this.paused) return;
    const unscaledNow = performance.now() / 1000;

    // time scaling: hit-stop freezes, KO slow-mo
    let scale = 1;
    if (unscaledNow < this.hitStopUntil) scale = 0.02;
    else if (unscaledNow < this.slowmoUntil) scale = FIGHT.koSlowmo;
    const dt = Math.min(rawDt, 0.05) * scale;
    this.now += dt;
    this.phaseTime += dt;

    this.input.pollPads();

    switch (this.phase) {
      case PHASE.INTRO: this.updateIntro(); break;
      case PHASE.FIGHT: this.updateFight(dt); break;
      case PHASE.ROUND_END: this.updateRoundEnd(dt); break;
      case PHASE.MATCH_END: break;
      default: break;
    }

    // fighters always update (except during hard pause)
    this.routeInput(this.f1, 0, dt);
    this.routeInput(this.f2, 1, dt);
    this.f1.update(dt, this.now, this.phase === PHASE.FIGHT ? this.f1.inputHeld : null);
    this.f2.update(dt, this.now, this.phase === PHASE.FIGHT ? this.f2.inputHeld : null);

    if (this.phase === PHASE.FIGHT) {
      this.combat.update([this.f1, this.f2], dt, this.now);
      this.processEvents(unscaledNow);
    }

    this.updateCamera(rawDt);
    this.fx.update(rawDt, this.camera);
  }

  updateIntro() {
    const t = this.phaseTime;
    if (this.introStep < 0 && t > 0.1) {
      this.introStep = 0;
      this.ui.banner(this.round === 1 ? 'ROUND 1' : this.round === 2 ? 'ROUND 2' : 'FINAL ROUND', 1100, 'round');
      this.audio.play('round');
    }
    if (this.introStep === 0 && t > 1.4) {
      this.introStep = 1;
      this.ui.banner('FIGHT!', 700, 'fight');
      this.audio.play('super');
    }
    if (this.introStep === 1 && t > 1.75) {
      this.phase = PHASE.FIGHT;
      this.phaseTime = 0;
    }
  }

  updateFight(dt) {
    // round timer
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      const winner = this.f1.health >= this.f2.health ? this.f1 : this.f2;
      const loser = winner === this.f1 ? this.f2 : this.f1;
      this.endRound(winner, loser, 'TIME UP');
      return;
    }
    this.ui.updateTimer(this.timer);
  }

  processEvents(unscaledNow) {
    for (const ev of this.combat.events) {
      if (ev.type === 'hit' || ev.type === 'ko') {
        this.fx.burst(ev.pos, new THREE.Color(ev.move.spark === 'energy' ? ev.attacker.cfg.accent : '#ffcc88'), ev.move.spark);
        if (ev.move.spark === 'big' || ev.move.spark === 'super') {
          this.fx.burst(ev.pos, new THREE.Color('#aa2211'), 'blood');
        }
        this.fx.addShake(ev.move.shake);
        this.audio.play(ev.move.sfx || 'punch1');
        this.hitStopUntil = unscaledNow + FIGHT.hitStop * (ev.move.spark === 'big' ? 1.6 : 1);
        this.ui.updateHealth(this.f1, this.f2);
        this.ui.updateMeters(this.f1, this.f2);
        if (ev.attacker.combo >= 2) this.ui.showCombo(ev.attacker);
      } else if (ev.type === 'block') {
        this.fx.burst(ev.pos, new THREE.Color('#8899ff'), 'small');
        this.audio.play('block');
        this.ui.updateHealth(this.f1, this.f2);
        this.ui.updateMeters(this.f1, this.f2);
      } else if (ev.type === 'combo_end') {
        this.ui.hideCombo(ev.fighter);
      }
      if (ev.type === 'ko') {
        const winner = ev.attacker, loser = ev.defender;
        this.audio.play('ko');
        this.fx.addShake(0.5);
        this.slowmoUntil = unscaledNow + 1.4;
        this.endRound(winner, loser, loser.health <= 0 && winner.health >= winner.maxHealth ? 'FLAWLESS' : 'K.O.');
      }
    }
  }

  endRound(winner, loser, label) {
    if (this.phase !== PHASE.FIGHT) return;
    this.phase = PHASE.ROUND_END;
    this.phaseTime = 0;
    this.roundWinner = winner;
    this.roundLabel = label;
    winner.roundsWon += 1;
    this.ui.banner(label, 1400, label === 'K.O.' ? 'ko' : 'round');
    this.ui.updateRounds(this.f1, this.f2);
    if (label === 'TIME UP' && loser.state !== STATE.KO) {
      // loser slumps — reuse block anim briefly
    }
  }

  updateRoundEnd(dt) {
    const t = this.phaseTime;
    if (t > 1.6 && !this._winnerCelebrated) {
      this._winnerCelebrated = true;
      if (this.roundWinner.state !== STATE.KO) this.roundWinner.setState(STATE.VICTORY);
      this.ui.banner(`${this.roundWinner.cfg.name} WINS`, 1500, 'win');
    }
    if (t > 3.3) {
      this._winnerCelebrated = false;
      if (this.roundWinner.roundsWon >= FIGHT.roundsToWin) {
        this.phase = PHASE.MATCH_END;
        if (this.onMatchEnd) this.onMatchEnd(this.roundWinner, this.roundWinner === this.f1 ? this.f2 : this.f1);
      } else {
        this.round += 1;
        this.startRound();
      }
    }
  }

  updateCamera(dt) {
    const f1 = this.f1, f2 = this.f2;
    const cx = (f1.x + f2.x) / 2;
    const cy = 1.15 + Math.max(f1.y, f2.y) * 0.35;
    const sep = Math.abs(f1.x - f2.x);
    let dist = THREE.MathUtils.clamp(2.7 + sep * 0.5, 3.1, 6.2);
    let targetY = 1.32 + Math.max(f1.y, f2.y) * 0.3;

    // KO cinematic: push in on the loser
    if (this.phase === PHASE.ROUND_END && this.phaseTime < 1.6) {
      const loser = this.roundWinner === f1 ? f2 : f1;
      dist = 2.4;
      this.camTarget.lerp(new THREE.Vector3(loser.x, 0.9, 0), Math.min(1, dt * 3));
      this.camPos.lerp(new THREE.Vector3(loser.x + 0.6, 1.15, dist), Math.min(1, dt * 3));
    } else {
      const clampedCx = THREE.MathUtils.clamp(cx, -FIGHT.stageHalfWidth + 2, FIGHT.stageHalfWidth - 2);
      this.camTarget.lerp(new THREE.Vector3(clampedCx, cy, 0), Math.min(1, dt * 6));
      this.camPos.lerp(new THREE.Vector3(clampedCx, targetY, dist), Math.min(1, dt * 4.5));
    }
    // subtle handheld sway
    const t = performance.now() / 1000;
    this.camera.position.copy(this.camPos);
    this.camera.position.x += Math.sin(t * 0.7) * 0.02;
    this.camera.position.y += Math.sin(t * 1.1) * 0.012;
    this.camera.lookAt(this.camTarget);
  }
}
