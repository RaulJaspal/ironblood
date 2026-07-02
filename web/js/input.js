// Input: keyboard (2 local layouts) + Gamepad API (PlayStation-style mapping).
// Produces per-player state {left,right,down,jump} + edge-triggered actions.

const P1_KEYS = {
  a: 'left', d: 'right', s: 'down', w: 'jump',
  u: 'lp', i: 'hp', j: 'lk', k: 'hk',
  o: 's1', l: 's2', p: 'super',
};
const P2_KEYS = {
  arrowleft: 'left', arrowright: 'right', arrowdown: 'down', arrowup: 'jump',
  b: 'lp', n: 'hp', m: 'lk', ',': 'hk',
  '.': 's1', '/': 's2', "'": 'super',
};

const PAD_MAP = { 2: 'lp', 3: 'hp', 0: 'lk', 1: 'hk', 5: 's1', 4: 's2', 7: 'super', 9: 'pause' };
// buttons: 0=Cross 1=Circle 2=Square 3=Triangle 4=L1 5=R1 6=L2 7=R2 9=Options

export class Input {
  constructor() {
    this.keys = new Set();
    this.actionQueue = [[], []]; // edge-triggered action names per player
    this.systemQueue = []; // pause/confirm/cancel events
    this.padIndex = [null, null]; // gamepad index assigned to player
    this.prevPadButtons = [{}, {}];
    this.prevPadAxes = [{}, {}];

    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (e.repeat) return;
      if (k === 'enter') this.systemQueue.push('confirm');
      if (k === 'escape') this.systemQueue.push('pause');
      if (P1_KEYS[k] && !['left', 'right', 'down', 'jump'].includes(P1_KEYS[k])) this.actionQueue[0].push(P1_KEYS[k]);
      if (P2_KEYS[k] && !['left', 'right', 'down', 'jump'].includes(P2_KEYS[k])) this.actionQueue[1].push(P2_KEYS[k]);
      if (P1_KEYS[k] === 'jump') this.actionQueue[0].push('jump');
      if (P2_KEYS[k] === 'jump') this.actionQueue[1].push('jump');
      // double-tap dash detection
      if (P1_KEYS[k] === 'left' || P1_KEYS[k] === 'right') this.checkDoubleTap(0, P1_KEYS[k]);
      if (P2_KEYS[k] === 'left' || P2_KEYS[k] === 'right') this.checkDoubleTap(1, P2_KEYS[k]);
      this.keys.add(k);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    addEventListener('gamepadconnected', (e) => {
      if (this.padIndex[0] === null) this.padIndex[0] = e.gamepad.index;
      else if (this.padIndex[1] === null && e.gamepad.index !== this.padIndex[0]) this.padIndex[1] = e.gamepad.index;
    });
    addEventListener('gamepaddisconnected', (e) => {
      if (this.padIndex[0] === e.gamepad.index) this.padIndex[0] = null;
      if (this.padIndex[1] === e.gamepad.index) this.padIndex[1] = null;
    });

    this.lastTap = [{ dir: null, t: 0 }, { dir: null, t: 0 }];
  }

  checkDoubleTap(player, dir) {
    const now = performance.now();
    const lt = this.lastTap[player];
    if (lt.dir === dir && now - lt.t < 250) {
      this.actionQueue[player].push(dir === 'left' ? 'dash_left' : 'dash_right');
    }
    this.lastTap[player] = { dir, t: now };
  }

  pollPads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let p = 0; p < 2; p++) {
      const idx = this.padIndex[p];
      if (idx === null || !pads[idx]) continue;
      const pad = pads[idx];
      const prev = this.prevPadButtons[p];
      for (const [btn, action] of Object.entries(PAD_MAP)) {
        const pressed = pad.buttons[btn] && pad.buttons[btn].pressed;
        if (pressed && !prev[btn]) {
          if (action === 'pause') this.systemQueue.push('pause');
          else this.actionQueue[p].push(action);
        }
        prev[btn] = pressed;
      }
      // dpad-up or stick-up = jump (edge)
      const up = (pad.buttons[12] && pad.buttons[12].pressed) || pad.axes[1] < -0.6;
      if (up && !prev.up) this.actionQueue[p].push('jump');
      prev.up = up;
      // dash via L2? use double-tap on stick: skip for pads, dedicated: button 6 (L2) = dash toward
      const dashBtn = pad.buttons[6] && pad.buttons[6].pressed;
      if (dashBtn && !prev.dash) this.actionQueue[p].push('dash_toward');
      prev.dash = dashBtn;
    }
  }

  // held state for player: {left, right, down}
  held(player) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const state = { left: false, right: false, down: false };
    const KEYS = player === 0 ? P1_KEYS : P2_KEYS;
    for (const [k, action] of Object.entries(KEYS)) {
      if (state[action] !== undefined && this.keys.has(k)) state[action] = true;
    }
    const idx = this.padIndex[player];
    if (idx !== null && pads[idx]) {
      const pad = pads[idx];
      if ((pad.buttons[14] && pad.buttons[14].pressed) || pad.axes[0] < -0.4) state.left = true;
      if ((pad.buttons[15] && pad.buttons[15].pressed) || pad.axes[0] > 0.4) state.right = true;
      if ((pad.buttons[13] && pad.buttons[13].pressed) || pad.axes[1] > 0.5) state.down = true;
    }
    return state;
  }

  drainActions(player) {
    const q = this.actionQueue[player];
    this.actionQueue[player] = [];
    return q;
  }

  drainSystem() {
    const q = this.systemQueue;
    this.systemQueue = [];
    return q;
  }

  anyPadStart() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (pad && pad.buttons[9] && pad.buttons[9].pressed) return true;
    }
    return false;
  }
}
