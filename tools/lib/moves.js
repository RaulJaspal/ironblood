// Hand-keyed fighting moves authored in canonical space:
// +Z = toward opponent, +X = character's anatomical left, +Y = up.
// Moves are layered on a *base pose* (frame 0 of the retargeted Melee_Hook
// clip = a proper mocap boxing guard, fists closed). Keys override specific
// bones with world-space aim directions; everything else keeps the base pose.
import { Quaternion, Vector3, MathUtils } from 'three';
import { computeWorld } from './skeleton.js';

const DIR_CHILD = {
  spine: 'spine1', spine1: 'spine2', spine2: 'neck', neck: 'head',
  lShoulder: 'lUpperArm', lUpperArm: 'lForeArm', lForeArm: 'lHand',
  rShoulder: 'rUpperArm', rUpperArm: 'rForeArm', rForeArm: 'rHand',
  lThigh: 'lCalf', lCalf: 'lFoot', lFoot: 'lToe',
  rThigh: 'rCalf', rCalf: 'rFoot', rFoot: 'rToe',
};

// ---------------- move definitions ----------------
// keys: [time, {sem: [x,y,z] aim dir (canonical)}, hips {x,y,z, yaw,pitch,roll degrees}]
// aim dirs override the base pose; hips offsets apply on top of the base hips.

const MOVES = {
  // breathing guard loop built purely from the base pose
  guard: {
    duration: 1.0, loop: true,
    keys: [
      [0.0, {}, {}],
      [0.5, {}, { y: -0.025, yaw: 2 }],
      [1.0, {}, {}],
    ],
  },

  // rear-leg roundhouse kick (right leg) to head height
  kick_round: {
    duration: 0.8,
    keys: [
      [0.0, {}, {}],
      // chamber: knee up across body, hips start rotating, slight lean back
      [0.18, {
        rThigh: [-0.15, -0.25, 0.95], rCalf: [-0.10, -0.88, -0.45], rFoot: [-0.05, -0.55, 0.83],
        lCalf: [0.02, -0.96, -0.26],
        spine2: [-0.06, 1, -0.10],
      }, { y: -0.06, yaw: 12 }],
      // extension: leg whips to head height, hips fully turned, torso counter-leans
      [0.32, {
        rThigh: [-0.32, 0.18, 0.93], rCalf: [-0.45, 0.28, 0.85], rFoot: [-0.45, 0.15, 0.88],
        lCalf: [0.04, -0.93, -0.34],
        spine: [-0.14, 1, -0.10], spine2: [-0.20, 1, -0.14], head: [-0.05, 1, 0.10],
      }, { y: -0.10, yaw: 48, roll: -10 }],
      // follow-through
      [0.44, {
        rThigh: [-0.12, -0.05, 0.98], rCalf: [-0.15, -0.45, 0.87],
        spine: [-0.10, 1, -0.06], spine2: [-0.12, 1, -0.10],
      }, { y: -0.09, yaw: 34 }],
      // retract through chamber back to guard
      [0.60, { rThigh: [-0.12, -0.50, 0.85], rCalf: [-0.08, -0.90, -0.38] }, { y: -0.06, yaw: 10 }],
      [0.80, {}, {}],
    ],
  },

  // lead-leg front snap kick (left leg), belly height — fast poke
  kick_front: {
    duration: 0.6,
    keys: [
      [0.0, {}, {}],
      [0.15, {
        lThigh: [0.06, -0.15, 0.98], lCalf: [0.02, -0.90, -0.42], lFoot: [0, -0.5, 0.86],
        rCalf: [-0.03, -0.95, -0.05],
      }, { y: -0.05, pitch: 4 }],
      [0.26, {
        lThigh: [0.04, 0.0, 1.0], lCalf: [0.02, -0.18, 0.98], lFoot: [0, -0.25, 0.97],
        spine2: [0, 1, -0.12],
      }, { y: -0.04, pitch: -7 }],
      [0.38, {
        lThigh: [0.06, -0.30, 0.95], lCalf: [0.02, -0.82, -0.36],
      }, { y: -0.05 }],
      [0.6, {}, {}],
    ],
  },

  // crouching leg sweep (right leg arcs across the floor)
  sweep: {
    duration: 0.8,
    keys: [
      [0.0, {}, {}],
      // drop into deep crouch, right leg extends to the side-back
      [0.16, {
        lThigh: [0.14, -0.50, 0.62], lCalf: [0.02, -0.92, -0.58],
        rThigh: [-0.55, -0.45, 0.45], rCalf: [-0.65, -0.42, 0.45],
        spine: [0, 1, 0.32], spine2: [0, 1, 0.26],
      }, { y: -0.36, yaw: -25, pitch: 16 }],
      // sweep: extended leg arcs to the front
      [0.34, {
        lThigh: [0.12, -0.55, 0.56], lCalf: [0.02, -0.90, -0.62],
        rThigh: [-0.15, -0.42, 0.90], rCalf: [-0.12, -0.38, 0.92],
        spine: [0, 1, 0.26],
      }, { y: -0.38, yaw: 35, pitch: 12 }],
      // continue across to the far side
      [0.48, {
        lThigh: [0.12, -0.55, 0.56], lCalf: [0.02, -0.90, -0.62],
        rThigh: [0.35, -0.40, 0.80], rCalf: [0.42, -0.36, 0.82],
        spine: [0, 1, 0.22],
      }, { y: -0.36, yaw: 62, pitch: 10 }],
      // recover to stance
      [0.64, { rThigh: [-0.12, -0.72, 0.30], rCalf: [-0.06, -0.88, -0.32] }, { y: -0.18, yaw: 8 }],
      [0.8, {}, {}],
    ],
  },

  // rising uppercut (right hand) — launcher
  uppercut: {
    duration: 0.66,
    keys: [
      [0.0, {}, {}],
      // dip: crouch, shoulders coil, right fist drops to hip
      [0.16, {
        rUpperArm: [-0.28, -0.92, 0.10], rForeArm: [-0.18, -0.42, 0.88],
        spine: [0, 1, 0.30], spine2: [0, 1, 0.26], head: [0, 1, 0.12],
        lCalf: [0.03, -0.90, -0.44], rCalf: [-0.04, -0.88, -0.20],
      }, { y: -0.20, yaw: -26, pitch: 18 }],
      // launch: fist rockets upward, back arches, body rises
      [0.30, {
        rUpperArm: [-0.10, 0.55, 0.80], rForeArm: [-0.02, 0.97, 0.22],
        lUpperArm: [0.45, -0.85, 0.20], lForeArm: [0.28, 0.35, 0.85],
        spine: [0, 1, -0.20], spine2: [0, 1, -0.24], head: [0, 1, -0.16],
      }, { y: 0.05, yaw: 16, pitch: -12 }],
      [0.44, {
        rUpperArm: [-0.12, 0.40, 0.88], rForeArm: [-0.02, 0.90, 0.34],
        spine: [0, 1, -0.12],
      }, { y: -0.01, yaw: 8 }],
      [0.66, {}, {}],
    ],
  },
};

// ---------------- clip construction ----------------

function smooth(a) { return a * a * (3 - 2 * a); }

function sampleAim(keys, t) {
  if (t <= keys[0].t) return keys[0].v;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a.t && t <= b.t) {
      const al = smooth((t - a.t) / Math.max(1e-6, b.t - a.t));
      return [a.v[0] + (b.v[0] - a.v[0]) * al, a.v[1] + (b.v[1] - a.v[1]) * al, a.v[2] + (b.v[2] - a.v[2]) * al];
    }
  }
  return last.v;
}

function sampleHips(keys, t) {
  const get = (k) => ({ x: k.x || 0, y: k.y || 0, z: k.z || 0, yaw: k.yaw || 0, pitch: k.pitch || 0, roll: k.roll || 0 });
  if (t <= keys[0].t) return get(keys[0].v);
  const last = keys[keys.length - 1];
  if (t >= last.t) return get(last.v);
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a.t && t <= b.t) {
      const al = smooth((t - a.t) / Math.max(1e-6, b.t - a.t));
      const va = get(a), vb = get(b), o = {};
      for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'roll']) o[k] = va[k] + (vb[k] - va[k]) * al;
      return o;
    }
  }
  return get(last.v);
}

// dst: {skel, rigMap, tpose}; base: {rot: Map<boneName, Quaternion local>, hipPos: Vector3 local}
export function buildKeyframedClips(dst, base, fps = 30) {
  const { skel, rigMap, tpose } = dst;
  const restWorld = computeWorld(skel);

  const lArm = tpose.get(rigMap.lUpperArm);
  const facing = lArm && lArm.p.x > 0 ? 1 : -1;

  // base pose world transforms (static FK with base local rotations)
  const basePose = new Map();
  for (const [bn, q] of base.rot) basePose.set(bn, { r: q });
  basePose.set(rigMap.hips, { r: base.rot.get(rigMap.hips), t: base.hipPos });
  const baseWorld = computeWorld(skel, basePose);

  // measure BASE-pose direction of each aimable bone (aims are absolute, but
  // rotation is computed as shortest-arc from the base pose direction)
  const baseDir = new Map(), baseLocal = new Map();
  for (const [sem, childSem] of Object.entries(DIR_CHILD)) {
    const bn = rigMap[sem], cn = rigMap[childSem];
    if (!bn || !cn || !baseWorld.get(bn) || !baseWorld.get(cn)) continue;
    const d = baseWorld.get(cn).p.clone().sub(baseWorld.get(bn).p);
    if (d.lengthSq() < 1e-10) continue;
    baseDir.set(sem, d.normalize());
  }
  for (const name of skel.order) {
    const b = skel.bones.get(name);
    const w = baseWorld.get(name);
    const pw = b.parentName ? baseWorld.get(b.parentName) : null;
    baseLocal.set(name, pw ? pw.r.clone().invert().multiply(w.r) : w.r.clone());
  }

  const pelvisName = rigMap.hips;
  const results = [];
  const q = new Quaternion(), q2 = new Quaternion(), v = new Vector3();

  for (const [moveName, def] of Object.entries(MOVES)) {
    const frames = Math.max(2, Math.round(def.duration * fps) + 1);
    const dt = def.duration / (frames - 1);
    const times = new Float32Array(frames);

    const boneKeys = new Map();
    const hipsKeys = [];
    for (const [t, bones, hips] of def.keys) {
      for (const [sem, dir] of Object.entries(bones)) {
        if (!boneKeys.has(sem)) boneKeys.set(sem, []);
        boneKeys.get(sem).push({ t, v: dir });
      }
      hipsKeys.push({ t, v: hips || {} });
    }
    // aimed bones start/end at their base direction if not keyed at 0/duration
    for (const [sem, keys] of boneKeys) {
      const bd = baseDir.get(sem);
      if (!bd) { boneKeys.delete(sem); continue; }
      const canonicalBase = [bd.x * facing, bd.y, bd.z * facing];
      if (keys[0].t > 0) keys.unshift({ t: 0, v: canonicalBase });
      if (keys[keys.length - 1].t < def.duration) keys.push({ t: def.duration, v: canonicalBase });
    }

    // output tracks: every bone that base or aims touch
    const outRot = new Map();
    for (const sem of boneKeys.keys()) outRot.set(rigMap[sem], new Float32Array(frames * 4));
    // all base bones (to freeze the guard pose against the skeleton rest)
    for (const bn of base.rot.keys()) if (!outRot.has(bn)) outRot.set(bn, new Float32Array(frames * 4));
    const pelvisRot = outRot.get(pelvisName) || new Float32Array(frames * 4);
    outRot.set(pelvisName, pelvisRot);
    const hipPos = new Float32Array(frames * 3);

    for (let f = 0; f < frames; f++) {
      const t = f * dt;
      times[f] = t;
      const hips = sampleHips(hipsKeys, t);

      // pelvis: canonical yaw/pitch/roll applied over base pelvis world rotation
      const eul = new Quaternion()
        .setFromAxisAngle(new Vector3(0, 1, 0), MathUtils.degToRad(hips.yaw * facing))
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(facing, 0, 0), MathUtils.degToRad(-hips.pitch)))
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, facing), MathUtils.degToRad(hips.roll)));
      const pelvisWorld = eul.clone().multiply(baseWorld.get(pelvisName).r);

      const worldFinal = new Map();
      for (const name of skel.order) {
        const b = skel.bones.get(name);
        const sem = semOf(rigMap, name);
        const parentWR = b.parentName && worldFinal.has(b.parentName) ? worldFinal.get(b.parentName) : null;
        let wr;
        if (name === pelvisName) {
          wr = pelvisWorld;
        } else if (sem && boneKeys.has(sem)) {
          const aim = sampleAim(boneKeys.get(sem), t);
          v.set(aim[0] * facing, aim[1], aim[2] * facing).normalize();
          q.setFromUnitVectors(baseDir.get(sem), v);
          wr = q.clone().multiply(baseWorld.get(rigMap[sem]).r);
        } else if (parentWR) {
          wr = parentWR.clone().multiply(baseLocal.get(name));
        } else {
          wr = baseWorld.get(name).r.clone();
        }
        worldFinal.set(name, wr);

        const store = outRot.get(name);
        if (store) {
          q2.copy(parentWR || new Quaternion()).invert().multiply(wr);
          store[f * 4] = q2.x; store[f * 4 + 1] = q2.y; store[f * 4 + 2] = q2.z; store[f * 4 + 3] = q2.w;
        }
      }

      // hips position: base local + canonical offset (offset is world-ish; hips
      // parent nodes are static, so transform offset into parent space)
      const hb = skel.bones.get(pelvisName);
      v.set((hips.x || 0) * facing, hips.y || 0, (hips.z || 0) * facing);
      let world = baseWorld.get(pelvisName).p.clone().add(v);
      let local = world;
      if (hb.parentName) local = world.applyMatrix4(restWorld.get(hb.parentName).m.clone().invert());
      hipPos[f * 3] = local.x; hipPos[f * 3 + 1] = local.y; hipPos[f * 3 + 2] = local.z;
    }

    results.push({ name: moveName, times, rotTracks: outRot, hipBone: pelvisName, hipPos });
  }
  return results;
}

function semOf(rigMap, boneName) {
  for (const k in rigMap) if (rigMap[k] === boneName) return k;
  return null;
}
