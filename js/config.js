// IRONBLOOD — game configuration: roster, stages, move frame data.

export const GAME_TITLE = 'IRONBLOOD';
export const TAGLINE = 'CHAMPIONS NEVER DIE';

export const ROSTER = [
  {
    id: 'brawler', name: 'KANE', title: 'The Pit Fighter', gender: 'male',
    desc: 'Undefeated in the underground circuit. Fights for the thrill alone.',
    accent: '#ff5533', specials: ['Blood Fireball', 'Sky Splitter'], speed: 1.06, power: 1.0, health: 100,
  },
  {
    id: 'street', name: 'DANTE', title: 'King of the Streets', gender: 'male',
    desc: 'Every back alley from here to the docks answers to him.',
    accent: '#33bbff', specials: ['Chain Harpoon', 'Shadow Step'], speed: 1.1, power: 0.95, health: 95,
  },
  {
    id: 'soldier_m', name: 'SGT. STONE', title: 'Special Forces', gender: 'male',
    desc: 'Three wars. Zero defeats. Discipline is his deadliest weapon.',
    accent: '#77aa44', specials: ['Frag Toss', 'Breacher Charge'], speed: 1.0, power: 1.05, health: 105,
  },
  {
    id: 'soldier_f', name: 'VALKYRIE', title: 'The War Machine', gender: 'female',
    desc: 'Armored, decorated, and utterly without mercy.',
    accent: '#aaccdd', specials: ['Rail Lance', 'Siege Ram'], speed: 0.94, power: 1.12, health: 110,
  },
  {
    id: 'heroine', name: 'MAYA', title: 'The Huntress', gender: 'female',
    desc: 'Tracked every champion alive. Now she hunts them one by one.',
    accent: '#ffcc44', specials: ['Dart Volley', 'Raptor Kick'], speed: 1.16, power: 0.9, health: 90,
  },
  {
    id: 'agent', name: 'MR. SLATE', title: 'The Syndicate', gender: 'male',
    desc: 'The house always wins. He makes sure of it personally.',
    accent: '#99aabb', specials: ['Dead Coin', 'Phantom Sweep'], speed: 1.04, power: 1.0, health: 100,
  },
  {
    id: 'bruiser', name: 'DOZER', title: 'Demolition Man', gender: 'male',
    desc: 'He does not knock buildings down for a living. Just people.',
    accent: '#ff9922', specials: ['Quake Slam', 'Wrecking Charge'], speed: 0.9, power: 1.18, health: 115,
  },
  {
    id: 'enforcer', name: 'WARDEN', title: 'The Enforcer', gender: 'male',
    desc: 'Thirty years keeping the peace. Tonight he breaks it.',
    accent: '#8877ff', specials: ['Cryo Bolt', 'Glacier Slide'], speed: 0.95, power: 1.06, health: 105,
  },
];

export const STAGES = [
  {
    id: 'pit', name: 'THE PIT',
    hdri: 'assets/env/dikhololo_night_2k.hdr',
    floor: 'concrete_floor_02', floorRepeat: 5, envIntensity: 0.5, bgIntensity: 0.32,
    fog: 0x0a0a10, fogDensity: 0.055,
    key: { color: 0xffd9b0, intensity: 3.0, pos: [3.5, 5, 3] },
    rim: { color: 0xff7744, intensity: 1.1, pos: [-5, 2.2, -3.5] },
    fill: { color: 0x334466, intensity: 0.8, pos: [0, 3, -5] },
    props: 'pit',
  },
  {
    id: 'metro', name: 'TERMINAL ZERO',
    hdri: 'assets/env/metro_noord_2k.hdr',
    floor: 'asphalt_02', floorRepeat: 4, envIntensity: 0.85, bgIntensity: 0.7,
    fog: 0x10131a, fogDensity: 0.04,
    key: { color: 0xcfe8ff, intensity: 2.8, pos: [-3, 5, 3.5] },
    rim: { color: 0x33ffcc, intensity: 1.3, pos: [5, 2.5, -3] },
    fill: { color: 0x223344, intensity: 0.9, pos: [0, 3, -5] },
    props: 'metro',
  },
  {
    id: 'court', name: 'MIDNIGHT SANCTUM',
    hdri: 'assets/env/courtyard_night_2k.hdr',
    floor: 'cobblestone_floor_08', floorRepeat: 5, envIntensity: 0.7, bgIntensity: 0.55,
    fog: 0x0c0a12, fogDensity: 0.045,
    key: { color: 0xfff2cc, intensity: 3.0, pos: [2.5, 4.5, 3.5] },
    rim: { color: 0x7755ff, intensity: 1.4, pos: [-4.5, 2.5, -3] },
    fill: { color: 0x442233, intensity: 0.7, pos: [0, 3, -5] },
    props: 'court',
  },
];

// Shared frame data. Times in seconds (real time, after timeScale).
// height: mid | low | overhead. Every move whiffs/connects once per activation.
export const MOVES = {
  jab: { anim: 'jab', total: 0.42, startup: 0.10, active: 0.12, dmg: 6, range: 1.02, height: 'mid', push: 0.22, hitAnim: 'hit_head', hitstun: 0.34, blockstun: 0.18, shake: 0.10, spark: 'small', sfx: 'punch1', lunge: 0.35 },
  cross: { anim: 'cross', total: 0.55, startup: 0.16, active: 0.12, dmg: 10, range: 1.1, height: 'mid', push: 0.35, hitAnim: 'hit_head', hitstun: 0.42, blockstun: 0.24, shake: 0.22, spark: 'med', sfx: 'punch2', lunge: 0.5 },
  hook: { anim: 'hook', total: 0.62, startup: 0.20, active: 0.12, dmg: 12, range: 1.05, height: 'mid', push: 0.45, hitAnim: 'hit_head', hitstun: 0.5, blockstun: 0.26, shake: 0.3, spark: 'med', sfx: 'punch2', lunge: 0.55 },
  kick_front: { anim: 'kick_front', total: 0.52, startup: 0.15, active: 0.12, dmg: 9, range: 1.3, height: 'mid', push: 0.5, hitAnim: 'hit_body', hitstun: 0.4, blockstun: 0.22, shake: 0.18, spark: 'small', sfx: 'kick1', lunge: 0.4 },
  kick_round: { anim: 'kick_round', total: 0.72, startup: 0.26, active: 0.14, dmg: 15, range: 1.5, height: 'mid', push: 0.75, hitAnim: 'hit_head', hitstun: 0.55, blockstun: 0.3, shake: 0.42, spark: 'big', sfx: 'kick2', lunge: 0.5 },
  sweep: { anim: 'sweep', total: 0.7, startup: 0.24, active: 0.15, dmg: 11, range: 1.35, height: 'low', push: 0.2, knockdown: true, hitAnim: 'launched', hitstun: 0.9, blockstun: 0.3, shake: 0.3, spark: 'small', sfx: 'kick1', lunge: 0.45 },
  uppercut: { anim: 'uppercut', total: 0.6, startup: 0.17, active: 0.13, dmg: 14, range: 0.95, height: 'mid', push: 0.3, launcher: true, hop: 2.3, hitAnim: 'launched', hitstun: 1.0, blockstun: 0.3, shake: 0.45, spark: 'big', sfx: 'punch3', lunge: 0.4, meterCost: 0 },
  // chain strikes (HP followups)
  strike_a: { anim: 'strike_a', total: 0.5, startup: 0.15, active: 0.12, dmg: 9, range: 1.15, height: 'mid', push: 0.3, hitAnim: 'hit_head', hitstun: 0.42, blockstun: 0.24, shake: 0.2, spark: 'med', sfx: 'punch2', lunge: 0.55 },
  strike_b: { anim: 'strike_b', total: 0.52, startup: 0.16, active: 0.12, dmg: 10, range: 1.15, height: 'mid', push: 0.35, hitAnim: 'hit_body', hitstun: 0.46, blockstun: 0.24, shake: 0.24, spark: 'med', sfx: 'punch2', lunge: 0.55 },
  strike_c: { anim: 'strike_c', total: 0.62, startup: 0.2, active: 0.13, dmg: 13, range: 1.2, height: 'mid', push: 0.8, knockdown: true, hitAnim: 'launched', hitstun: 0.9, blockstun: 0.3, shake: 0.4, spark: 'big', sfx: 'punch3', lunge: 0.6 },
  // air attack
  air_kick: { anim: 'kick_front', total: 0.45, startup: 0.12, active: 0.2, dmg: 11, range: 1.25, height: 'overhead', push: 0.4, hitAnim: 'hit_head', hitstun: 0.45, blockstun: 0.26, shake: 0.24, spark: 'med', sfx: 'kick2', air: true },
  // ---- specials (per-character kits) ----
  fireball: { anim: 'fireball', total: 0.85, startup: 0.38, active: 0.05, dmg: 12, range: 0, height: 'mid', push: 0.6, projectile: { times: [0.38], speed: 7.5, size: 0.2 }, hitAnim: 'hit_body', hitstun: 0.5, blockstun: 0.3, chip: 3, shake: 0.2, spark: 'energy', sfx: 'fire', meterGain: 8 },
  charge: { anim: 'shoulder_charge', total: 0.75, startup: 0.22, active: 0.3, dmg: 14, range: 1.1, height: 'mid', push: 1.2, knockdown: true, hitAnim: 'launched', hitstun: 0.9, blockstun: 0.35, chip: 3, shake: 0.5, spark: 'big', sfx: 'charge', dash: 4.2, lunge: 0 },
  // DANTE: harpoon that drags the target in ("get over here" energy)
  harpoon: { anim: 'fireball', total: 0.8, startup: 0.36, active: 0.05, dmg: 8, range: 0, height: 'mid', push: 0, projectile: { times: [0.36], speed: 9.5, size: 0.11, color: '#ffaa33', pull: true }, hitAnim: 'hit_body', hitstun: 1.1, blockstun: 0.25, chip: 2, shake: 0.25, spark: 'energy', sfx: 'fire' },
  // DANTE: vanish, reappear behind the opponent, strike
  teleport_strike: { anim: 'strike_a', total: 0.66, startup: 0.36, active: 0.12, dmg: 12, range: 1.15, height: 'mid', push: 0.9, knockdown: true, teleport: { at: 0.16, behind: 0.95 }, hitAnim: 'launched', hitstun: 0.9, blockstun: 0.3, chip: 2, shake: 0.35, spark: 'big', sfx: 'punch3', lunge: 0 },
  // SGT. STONE: lobbed grenade with area blast
  grenade: { anim: 'overhand_throw', total: 0.9, startup: 0.42, active: 0.05, dmg: 15, range: 0, height: 'mid', push: 1.0, knockdown: true, projectile: { times: [0.42], speed: 4.4, size: 0.1, color: '#a8b868', arc: { vy: 3.4, g: 9.5 }, explode: 1.0 }, hitAnim: 'launched', hitstun: 0.9, blockstun: 0.35, chip: 4, shake: 0.45, spark: 'big', sfx: 'fire' },
  // VALKYRIE: fast piercing energy lance
  lance: { anim: 'fireball', total: 0.8, startup: 0.36, active: 0.05, dmg: 14, range: 0, height: 'mid', push: 0.7, projectile: { times: [0.36], speed: 11, size: 0.15, color: '#55ddff' }, hitAnim: 'hit_body', hitstun: 0.55, blockstun: 0.3, chip: 4, shake: 0.25, spark: 'energy', sfx: 'fire' },
  // MAYA: three-dart volley
  darts: { anim: 'fireball', total: 0.95, startup: 0.34, active: 0.05, dmg: 4, range: 0, height: 'mid', push: 0.2, projectile: { times: [0.34, 0.47, 0.6], speed: 10, size: 0.07, color: '#ffcc44' }, hitAnim: 'hit_body', hitstun: 0.3, blockstun: 0.15, chip: 1, shake: 0.12, spark: 'small', sfx: 'whoosh' },
  // MAYA: rising flip kick launcher
  flip_kick: { anim: 'flip_jump', total: 0.7, startup: 0.2, active: 0.16, dmg: 13, range: 1.05, height: 'mid', push: 0.4, launcher: true, hop: 2.6, hitAnim: 'launched', hitstun: 1.0, blockstun: 0.3, chip: 0, shake: 0.4, spark: 'big', sfx: 'kick2', lunge: 0.4 },
  // MR. SLATE: razor coin — cheap, fast, builds big meter
  coin: { anim: 'fireball', total: 0.7, startup: 0.3, active: 0.05, dmg: 5, range: 0, height: 'mid', push: 0.25, projectile: { times: [0.3], speed: 12.5, size: 0.08, color: '#ffee88' }, hitAnim: 'hit_body', hitstun: 0.32, blockstun: 0.15, chip: 1, shake: 0.1, spark: 'small', sfx: 'whoosh', meterGain: 14 },
  // MR. SLATE: phantom sweep — teleport behind into a low sweep
  shadow_sweep: { anim: 'sweep', total: 0.74, startup: 0.4, active: 0.15, dmg: 10, range: 1.25, height: 'low', push: 0.3, knockdown: true, teleport: { at: 0.18, behind: 0.9 }, hitAnim: 'launched', hitstun: 0.9, blockstun: 0.3, chip: 2, shake: 0.3, spark: 'med', sfx: 'kick1', lunge: 0 },
  // DOZER: slam the ground, send a shockwave along the floor
  ground_pound: { anim: 'strike_c', total: 0.85, startup: 0.4, active: 0.05, dmg: 13, range: 0, height: 'low', push: 0.8, knockdown: true, projectile: { times: [0.4], speed: 5.5, size: 0.26, color: '#ff9922', ground: true }, hitAnim: 'launched', hitstun: 0.9, blockstun: 0.35, chip: 3, shake: 0.5, spark: 'big', sfx: 'charge' },
  // WARDEN: cryo bolt — freezes the target solid
  iceblast: { anim: 'fireball', total: 0.85, startup: 0.38, active: 0.05, dmg: 6, range: 0, height: 'mid', push: 0, projectile: { times: [0.38], speed: 7, size: 0.19, color: '#66ddff', freeze: 1.35 }, hitAnim: 'hit_body', hitstun: 0.4, blockstun: 0.3, chip: 2, shake: 0.2, spark: 'energy', sfx: 'fire' },
  // WARDEN: glacier slide — low sliding tackle
  ice_slide: { anim: 'slide_start', total: 0.75, startup: 0.2, active: 0.3, dmg: 11, range: 1.0, height: 'low', push: 1.0, knockdown: true, hitAnim: 'launched', hitstun: 0.9, blockstun: 0.35, chip: 3, shake: 0.4, spark: 'energy', sfx: 'charge', dash: 4.6, lunge: 0 },
  // super (requires full meter)
  super: { anim: 'super_combo', total: 1.9, startup: 0.25, active: 1.2, dmg: 34, range: 1.35, height: 'mid', push: 1.4, knockdown: true, hitAnim: 'launched', hitstun: 2.0, blockstun: 0.5, chip: 8, multihit: [0.3, 0.55, 0.85, 1.25], shake: 0.6, spark: 'super', sfx: 'super', lunge: 1.2 },
};

// character-specific move kit variations
export const KITS = {
  brawler: { s1: 'fireball', s2: 'uppercut' },
  street: { s1: 'harpoon', s2: 'teleport_strike' },
  soldier_m: { s1: 'grenade', s2: 'charge' },
  soldier_f: { s1: 'lance', s2: 'charge' },
  heroine: { s1: 'darts', s2: 'flip_kick' },
  agent: { s1: 'coin', s2: 'shadow_sweep' },
  bruiser: { s1: 'ground_pound', s2: 'charge' },
  enforcer: { s1: 'iceblast', s2: 'ice_slide' },
};

export const FIGHT = {
  roundTime: 99,
  roundsToWin: 2,
  stageHalfWidth: 5.6,
  walkSpeed: 1.55,
  backSpeed: 1.25,
  dashSpeed: 4.6,
  dashTime: 0.28,
  jumpVel: 4.7,
  gravity: 12.5,
  jumpDriftX: 2.2,
  pushboxRadius: 0.42,
  maxMeter: 100,
  hitStop: 0.075,
  koSlowmo: 0.22,
};
