// IRONBLOOD — boot, renderer, screen flow.
import * as THREE from 'three';
import { ROSTER, STAGES } from './config.js';
import { buildStage } from './stage.js';
import { FightSession } from './game.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { FX } from './fx.js';
import { AudioEngine } from './audio.js';
import { loadCharacter, loadAnims, loadHDRI, loadFloorSet, instantiateCharacter } from './assets.js';

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 1.4, 4.6);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const input = new Input();
const ui = new UI();
const fx = new FX(scene);
const audio = new AudioEngine();

// ---------- screen helpers ----------
const screens = ['loading', 'title', 'controls', 'select', 'stage', 'vs', 'pause', 'victory'];
function showScreen(name) {
  for (const s of screens) {
    document.getElementById(`screen-${s}`).classList.toggle('hidden', s !== name);
  }
}
function hideScreens() { for (const s of screens) document.getElementById(`screen-${s}`).classList.add('hidden'); }

// ---------- app state machine ----------
const app = {
  state: 'loading',
  mode: 'arcade',
  p1Pick: 0, p2Pick: 1,
  stageIdx: 0, stagePick: -1, stageCursor: 0,
  session: null,
  stageGroup: null,
  arcadeLadder: [], arcadeIdx: 0, difficulty: 2,
  titleIdx: 0, pauseIdx: 0, victoryIdx: 0,
  selectPhase: 0, // 0 = p1 picking, 1 = p2 picking (versus)
  previewModel: null,
};

// ---------- boot: preload minimal, build title scene ----------
const loadTips = ['Sharpening fists…', 'Lacing gloves…', 'Waking the crowd…', 'Polishing the arena…', 'Counting teeth…'];
let tipIdx = 0;
const tipTimer = setInterval(() => {
  document.getElementById('load-tip').textContent = loadTips[++tipIdx % loadTips.length];
}, 900);

async function boot() {
  const stageCfg = STAGES[Math.floor(Math.random() * STAGES.length)];
  app.stageIdx = STAGES.indexOf(stageCfg);
  const tasks = [
    buildStage(scene, renderer, stageCfg),
    loadAnims('male'), loadAnims('female'),
    loadCharacter(ROSTER[0].id),
  ];
  let done = 0;
  const fill = document.getElementById('loadbar-fill');
  await Promise.all(tasks.map((p) => Promise.resolve(p).then((r) => {
    fill.style.width = `${(++done / tasks.length) * 100}%`;
    return r;
  }))).then(([stageGroup]) => { app.stageGroup = stageGroup; });
  clearInterval(tipTimer);

  // title-screen showpiece: KANE shadowboxing mid-stage
  app.previewModel = await makePreview(ROSTER[0], 0, 'guard');
  app.state = 'title';
  showScreen('title');
  requestAnimationFrame(tick);
}

async function makePreview(cfg, x = 0, clip = 'select_idle') {
  const model = await instantiateCharacter(cfg.id);
  const clips = await loadAnims(cfg.gender);
  model.position.set(x, 0, 0);
  model.rotation.y = 0.4;
  const mixer = new THREE.AnimationMixer(model);
  const c = clips.get(clip) || clips.get('guard');
  mixer.clipAction(c).play();
  scene.add(model);
  return { model, mixer };
}

function removePreview() {
  if (app.previewModel) {
    scene.remove(app.previewModel.model);
    app.previewModel = null;
  }
}

// ---------- character select ----------
function buildSelectGrid() {
  const grid = document.getElementById('select-grid');
  grid.innerHTML = '';
  ROSTER.forEach((c, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.idx = i;
    cell.style.backgroundImage = `url(assets/portraits/${c.id}.png)`;
    const label = document.createElement('span');
    label.textContent = c.name;
    cell.appendChild(label);
    grid.appendChild(cell);
  });
}

function refreshSelect() {
  const cells = document.querySelectorAll('#select-grid .cell');
  cells.forEach((cell, i) => {
    cell.classList.toggle('p1', i === app.p1Pick && (app.selectPhase === 0 || app.mode === 'versus'));
    cell.classList.toggle('p2', app.mode === 'versus' ? (app.selectPhase === 1 && i === app.p2Pick) : false);
    cell.classList.toggle('locked-p1', app.selectPhase === 1 && i === app.p1Pick);
  });
  const c1 = ROSTER[app.p1Pick];
  document.getElementById('sel-name-p1').textContent = c1.name;
  document.getElementById('sel-title-p1').textContent = c1.title;
  document.getElementById('sel-desc-p1').textContent = c1.desc;
  document.getElementById('select-info-p1').style.setProperty('--accent', c1.accent);
  const showP2 = app.mode === 'versus' && app.selectPhase === 1;
  document.getElementById('select-info-p2').style.visibility = showP2 ? 'visible' : 'hidden';
  if (showP2) {
    const c2 = ROSTER[app.p2Pick];
    document.getElementById('sel-name-p2').textContent = c2.name;
    document.getElementById('sel-title-p2').textContent = c2.title;
    document.getElementById('sel-desc-p2').textContent = c2.desc;
    document.getElementById('select-info-p2').style.setProperty('--accent', c2.accent);
  }
  document.getElementById('select-heading').textContent =
    app.selectPhase === 0 ? 'CHOOSE YOUR FIGHTER' : 'PLAYER 2 — CHOOSE';
  document.getElementById('select-hint').textContent =
    app.selectPhase === 0 ? 'P1: A/D move · ENTER confirm' : 'P2: ←/→ move · ENTER confirm';
  updateSelectPreview();
}

let previewToken = 0;
async function updateSelectPreview() {
  const cfg = ROSTER[app.selectPhase === 0 ? app.p1Pick : app.p2Pick];
  const token = ++previewToken;
  removePreview();
  const pv = await makePreview(cfg, 0, 'select_pose');
  if (token !== previewToken) { scene.remove(pv.model); return; }
  app.previewModel = pv;
  audio.play('select');
}

// ---------- fight flow ----------
async function startMatch() {
  hideScreens();
  removePreview();
  // rebuild stage if changed
  const stageCfg = STAGES[app.stageIdx];
  if (app.stageGroup) { scene.remove(app.stageGroup); app.stageGroup = null; }
  app.stageGroup = await buildStage(scene, renderer, stageCfg);

  const p1 = ROSTER[app.p1Pick];
  const p2 = app.mode === 'arcade' ? ROSTER[app.arcadeLadder[app.arcadeIdx]] : ROSTER[app.p2Pick];
  app.session = new FightSession({
    scene, camera, fx, audio, ui, input,
    p1, p2, mode: app.mode,
    difficulty: Math.min(8, app.difficulty + app.arcadeIdx),
  });
  app.session.onMatchEnd = onMatchEnd;
  await app.session.load();
  app.state = 'fight';
  audio.startMusic();
}

function onMatchEnd(winner, loser) {
  ui.hideHUD();
  const p1Won = winner === app.session.f1;
  const vt = document.getElementById('victory-title');
  const vs = document.getElementById('victory-sub');
  const menu = document.getElementById('victory-menu');
  app.victoryIdx = 0;

  if (app.mode === 'arcade') {
    if (p1Won) {
      if (app.arcadeIdx >= app.arcadeLadder.length - 1) {
        vt.textContent = 'CHAMPION';
        vs.textContent = `${winner.cfg.name} has conquered the IRONBLOOD tournament. Champions never die.`;
        menu.querySelector('[data-act="next"]').textContent = 'ROLL CREDITS';
      } else {
        vt.textContent = 'VICTORY';
        vs.textContent = `Opponent ${app.arcadeIdx + 1} of ${app.arcadeLadder.length} defeated. The ladder continues…`;
        menu.querySelector('[data-act="next"]').textContent = 'NEXT OPPONENT';
      }
    } else {
      vt.textContent = 'DEFEAT';
      vs.textContent = `${loser.cfg.name} falls in the ${['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][app.arcadeIdx] || ''} round of the tournament.`;
      menu.querySelector('[data-act="next"]').textContent = 'TRY AGAIN';
    }
  } else {
    vt.textContent = `${winner.cfg.name} WINS`;
    vs.textContent = 'The grudge is settled. For now.';
    menu.querySelector('[data-act="next"]').textContent = 'REMATCH';
  }
  refreshMenu('victory-menu', app.victoryIdx);
  showScreen('victory');
  app.state = 'victory';
  app._victoryWon = p1Won;
}

function endSession() {
  if (app.session) { app.session.destroy(); app.session = null; }
  ui.hideHUD();
}

// ---------- menu helpers ----------
function refreshMenu(id, idx) {
  document.querySelectorAll(`#${id} .menu-item`).forEach((el, i) => el.classList.toggle('selected', i === idx));
}

function menuNav(id, idxKey, dir) {
  const items = document.querySelectorAll(`#${id} .menu-item`);
  app[idxKey] = (app[idxKey] + dir + items.length) % items.length;
  refreshMenu(id, app[idxKey]);
  audio.play('select');
}

// ---------- global input handling (menus) ----------
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  audio.resume();

  if (app.state === 'title') {
    const menu = document.getElementById('title-menu');
    if (menu.classList.contains('hidden')) {
      if (k === 'enter') {
        menu.classList.remove('hidden');
        document.querySelector('#screen-title .press-start').classList.add('hidden');
        audio.play('confirm');
      }
      return;
    }
    if (k === 'w' || k === 'arrowup') menuNav('title-menu', 'titleIdx', -1);
    if (k === 's' || k === 'arrowdown') menuNav('title-menu', 'titleIdx', 1);
    if (k === 'enter') {
      const mode = document.querySelectorAll('#title-menu .menu-item')[app.titleIdx].dataset.mode;
      audio.play('confirm');
      if (mode === 'controls') { app.state = 'controls'; showScreen('controls'); return; }
      app.mode = mode;
      app.selectPhase = 0;
      buildSelectGrid();
      refreshSelect();
      showScreen('select');
      app.state = 'select';
    }
  } else if (app.state === 'controls') {
    if (k === 'enter' || k === 'escape') { app.state = 'title'; showScreen('title'); }
  } else if (app.state === 'select') {
    const phase = app.selectPhase;
    const pickKey = phase === 0 ? 'p1Pick' : 'p2Pick';
    const cols = 4;
    let moved = false;
    const isP1 = phase === 0;
    const L = isP1 ? 'a' : 'arrowleft', R = isP1 ? 'd' : 'arrowright', U = isP1 ? 'w' : 'arrowup', D = isP1 ? 's' : 'arrowdown';
    if (k === L) { app[pickKey] = (app[pickKey] + ROSTER.length - 1) % ROSTER.length; moved = true; }
    if (k === R) { app[pickKey] = (app[pickKey] + 1) % ROSTER.length; moved = true; }
    if (k === U) { app[pickKey] = (app[pickKey] + ROSTER.length - cols) % ROSTER.length; moved = true; }
    if (k === D) { app[pickKey] = (app[pickKey] + cols) % ROSTER.length; moved = true; }
    if (moved) refreshSelect();
    if (k === 'escape') { app.state = 'title'; removePreview(); makePreview(ROSTER[0], 0, 'guard').then((p) => (app.previewModel = p)); showScreen('title'); return; }
    if (k === 'enter') {
      audio.play('confirm');
      if (app.mode === 'versus' && phase === 0) {
        app.selectPhase = 1;
        if (app.p2Pick === app.p1Pick) app.p2Pick = (app.p1Pick + 1) % ROSTER.length;
        refreshSelect();
      } else {
        // arcade: build ladder
        if (app.mode === 'arcade') {
          app.arcadeLadder = ROSTER.map((_, i) => i).filter((i) => i !== app.p1Pick);
          for (let i = app.arcadeLadder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [app.arcadeLadder[i], app.arcadeLadder[j]] = [app.arcadeLadder[j], app.arcadeLadder[i]];
          }
          app.arcadeIdx = 0;
        }
        showStageSelect();
      }
    }
  } else if (app.state === 'stage') {
    const cards = document.querySelectorAll('#stage-row .stage-card');
    if (['a', 'arrowleft'].includes(k)) { app.stageCursor = (app.stageCursor + cards.length - 1) % cards.length; refreshStageSelect(); }
    if (['d', 'arrowright'].includes(k)) { app.stageCursor = (app.stageCursor + 1) % cards.length; refreshStageSelect(); }
    if (k === 'escape') { app.state = 'select'; showScreen('select'); refreshSelect(); return; }
    if (k === 'enter') {
      audio.play('confirm');
      app.stagePick = parseInt(cards[app.stageCursor].dataset.stage, 10);
      app.stageIdx = app.stagePick === -1 ? Math.floor(Math.random() * STAGES.length) : app.stagePick;
      showVsScreen();
    }
  } else if (app.state === 'fight') {
    if (k === 'escape') {
      app.session.paused = true;
      app.pauseIdx = 0;
      refreshMenu('pause-menu', 0);
      showScreen('pause');
      app.state = 'pause';
    }
  } else if (app.state === 'pause') {
    if (k === 'w' || k === 'arrowup') menuNav('pause-menu', 'pauseIdx', -1);
    if (k === 's' || k === 'arrowdown') menuNav('pause-menu', 'pauseIdx', 1);
    if (k === 'escape') { resumeFight(); }
    if (k === 'enter') {
      const act = document.querySelectorAll('#pause-menu .menu-item')[app.pauseIdx].dataset.act;
      audio.play('confirm');
      if (act === 'resume') resumeFight();
      else if (act === 'restart') { endSession(); hideScreens(); startMatch(); }
      else { endSession(); backToTitle(); }
    }
  } else if (app.state === 'victory') {
    if (k === 'w' || k === 'arrowup') menuNav('victory-menu', 'victoryIdx', -1);
    if (k === 's' || k === 'arrowdown') menuNav('victory-menu', 'victoryIdx', 1);
    if (k === 'enter') {
      const act = document.querySelectorAll('#victory-menu .menu-item')[app.victoryIdx].dataset.act;
      audio.play('confirm');
      endSession();
      if (act === 'next') {
        if (app.mode === 'arcade') {
          if (app._victoryWon) {
            if (app.arcadeIdx >= app.arcadeLadder.length - 1) { backToTitle(); return; }
            app.arcadeIdx += 1;
          }
          if (app.stagePick === -1) app.stageIdx = Math.floor(Math.random() * STAGES.length);
          showVsScreen();
        } else {
          startMatch();
        }
      } else if (act === 'select') {
        app.selectPhase = 0;
        buildSelectGrid();
        refreshSelect();
        showScreen('select');
        app.state = 'select';
      } else {
        backToTitle();
      }
    }
  }
});

function resumeFight() {
  app.session.paused = false;
  hideScreens();
  app.state = 'fight';
}

function backToTitle() {
  endSession();
  audio.stopMusic();
  app.state = 'title';
  app.titleIdx = 0;
  document.getElementById('title-menu').classList.remove('hidden');
  refreshMenu('title-menu', 0);
  showScreen('title');
  makePreview(ROSTER[0], 0, 'guard').then((p) => { removePreview(); app.previewModel = p; });
}

function showStageSelect() {
  removePreview();
  refreshStageSelect();
  showScreen('stage');
  app.state = 'stage';
}

function refreshStageSelect() {
  document.querySelectorAll('#stage-row .stage-card').forEach((el, i) => {
    el.classList.toggle('selected', i === app.stageCursor);
  });
  audio.play('select');
}

function showVsScreen() {
  const p1 = ROSTER[app.p1Pick];
  const p2 = app.mode === 'arcade' ? ROSTER[app.arcadeLadder[app.arcadeIdx]] : ROSTER[app.p2Pick];
  document.getElementById('vs-portrait-p1').style.backgroundImage = `url(assets/portraits/${p1.id}.png)`;
  document.getElementById('vs-portrait-p2').style.backgroundImage = `url(assets/portraits/${p2.id}.png)`;
  document.getElementById('vs-name-p1').textContent = p1.name;
  document.getElementById('vs-name-p2').textContent = p2.name;
  document.getElementById('vs-stage').textContent = STAGES[app.stageIdx].name;
  showScreen('vs');
  app.state = 'vs';
  removePreview();
  audio.play('round');
  setTimeout(() => { if (app.state === 'vs') startMatch(); }, 2400);
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let slowFrames = 0;
function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();

  if ((app.state === 'fight' || app.state === 'pause' || app.state === 'victory') && app.session) {
    app.session.update(dt);
  } else {
    // ambient camera for menus
    const t = performance.now() / 1000;
    camera.position.set(Math.sin(t * 0.12) * 2.6, 1.5 + Math.sin(t * 0.2) * 0.1, 4.4 + Math.cos(t * 0.15) * 0.4);
    camera.lookAt(0, 1.1, 0);
    if (app.previewModel) app.previewModel.mixer.update(dt);
    fx.update(dt, null);
  }

  // adaptive quality: drop pixel ratio if struggling
  if (dt > 1 / 25) { if (++slowFrames === 60) renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25)); }

  const stage = scene.getObjectByName('stage');
  if (stage) {
    const dust = stage.getObjectByName('dust');
    if (dust) dust.userData.update(performance.now() / 1000);
  }
  renderer.render(scene, camera);
}

// debug handle (used by automated tests)
window.__game = app;

boot();
