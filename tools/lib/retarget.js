// Rotation-based retargeting between humanoid skeletons with different
// bone names and rest poses, via canonical T-pose alignment.
import { Quaternion, Vector3 } from 'three';
import { computeWorld, sampleQuat, sampleVec } from './skeleton.js';

// Canonical bone directions in model space for a character standing on +Y up,
// facing +Z, anatomical left = +X. `dirs` maps semantic joints to the direction
// their bone (joint -> child joint) should point in a T-pose.
const CANON = {
  spine: [0, 1, 0], spine1: [0, 1, 0], spine2: [0, 1, 0],
  neck: [0, 1, 0], head: [0, 1, 0],
  lShoulder: [1, 0, 0], lUpperArm: [1, 0, 0], lForeArm: [1, 0, 0], lHand: [1, 0, 0],
  rShoulder: [-1, 0, 0], rUpperArm: [-1, 0, 0], rForeArm: [-1, 0, 0], rHand: [-1, 0, 0],
  lThigh: [0, -1, 0], lCalf: [0, -1, 0],
  rThigh: [0, -1, 0], rCalf: [0, -1, 0],
  // feet/toes/fingers keep their rest orientation relative to parent (no canon dir)
};

// For direction measurement we need to know which child joint defines each bone's direction.
// chains: semantic -> [selfKey, childKey] resolved through the rig map.
const CHAIN_CHILD = {
  spine: 'spine1', spine1: 'spine2', spine2: 'neck',
  neck: 'head',
  lShoulder: 'lUpperArm', lUpperArm: 'lForeArm', lForeArm: 'lHand',
  rShoulder: 'rUpperArm', rUpperArm: 'rForeArm', rForeArm: 'rHand',
  lThigh: 'lCalf', lCalf: 'lFoot',
  rThigh: 'rCalf', rCalf: 'rFoot',
};

// Compute, for every mapped bone, the world rotation of the skeleton posed in a
// canonical T-pose. Non-canonical bones inherit their parent's adjustment so
// local rest offsets are preserved (hands, feet, fingers, facial bones...).
//
// skel: skeleton struct; rigMap: semantic -> boneName; basePose: optional pose Map
// (e.g. a sampled T-pose clip frame for rigs whose rest pose is not a T-pose).
// facingSign: +1 if the rig faces +Z with left=+X, -1 if it faces -Z with left=-X.
export function computeTPoseWorld(skel, rigMap, basePose = new Map(), facingSign = 1) {
  const world = computeWorld(skel, basePose);
  const nameToSem = new Map(Object.entries(rigMap).map(([sem, bn]) => [bn, sem]));
  const adjusted = new Map(); // boneName -> {r: Quaternion (world), p: Vector3}
  const qTmp = new Quaternion();

  for (const name of skel.order) {
    const b = skel.bones.get(name);
    const w = world.get(name);
    const parentAdj = b.parentName ? adjusted.get(b.parentName) : null;

    // world transform after parent adjustments: rotate this bone's rest world
    // by the accumulated parent delta around the parent joint position.
    let curR, curP;
    if (parentAdj) {
      const pw = world.get(b.parentName);
      const delta = parentAdj.r.clone().multiply(pw.r.clone().invert()); // world delta of parent
      curR = delta.clone().multiply(w.r);
      curP = w.p.clone().sub(pw.p).applyQuaternion(delta).add(parentAdj.p);
    } else {
      curR = w.r.clone();
      curP = w.p.clone();
    }

    const sem = nameToSem.get(name);
    const canonDir = sem && CANON[sem];
    if (canonDir && CHAIN_CHILD[sem] && rigMap[CHAIN_CHILD[sem]]) {
      const childName = rigMap[CHAIN_CHILD[sem]];
      const cw = world.get(childName);
      if (cw) {
        // child position after our current (pre-align) adjustment
        const pw = world.get(name);
        const deltaHere = curR.clone().multiply(pw.r.clone().invert());
        const childP = cw.p.clone().sub(pw.p).applyQuaternion(deltaHere).add(curP);
        const dir = childP.sub(curP);
        if (dir.lengthSq() > 1e-10) {
          dir.normalize();
          // left/right X directions flip with facing; Y stays.
          const tgt = new Vector3(canonDir[0] * facingSign, canonDir[1], canonDir[2] * facingSign);
          qTmp.setFromUnitVectors(dir, tgt.normalize());
          curR = qTmp.clone().multiply(curR);
        }
      }
    }
    adjusted.set(name, { r: curR, p: curP });
  }
  return adjusted; // Map<boneName, {r, p}> in canonical T-pose
}

// Retarget one clip.
// src: {skel, clips-channels, tpose (from computeTPoseWorld), rigMap, facingSign}
// dst: {skel, tpose, rigMap}
// clip: {name, duration, channels}
// opts: {fps, hipScale} — hipScale: dstHipsHeight / srcHipsHeight
// Returns {name, times, tracks: Map<boneName, {rot: Float32Array}>, hipPos: Float32Array}
export function retargetClip(src, dst, clip, opts = {}) {
  const fps = opts.fps || 30;
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
  const dt = clip.duration / (frames - 1);

  // semantic maps
  const semList = Object.keys(src.rigMap).filter((sem) => dst.rigMap[sem]);
  const srcHips = src.rigMap.hips, dstHips = dst.rigMap.hips;

  // Precompute offsets: offset(bone) = inv(srcTPoseR) * dstTPoseR
  const offsets = new Map();
  for (const sem of semList) {
    const sTP = src.tpose.get(src.rigMap[sem]);
    const dTP = dst.tpose.get(dst.rigMap[sem]);
    if (!sTP || !dTP) continue;
    offsets.set(sem, sTP.r.clone().invert().multiply(dTP.r));
  }

  // dst rest world (unposed) for computing locals of unmapped parents
  const dstRestWorld = computeWorld(dst.skel);

  const times = new Float32Array(frames);
  const outRot = new Map(); // dstBoneName -> Float32Array(frames*4)
  for (const sem of semList) {
    if (!offsets.has(sem)) continue;
    outRot.set(dst.rigMap[sem], new Float32Array(frames * 4));
  }
  const hipPos = new Float32Array(frames * 3);

  const q = new Quaternion(), v = new Vector3();

  // source hips rest height (in canonical/base pose)
  const srcHipsRestP = src.tpose.get(srcHips).p;
  const dstHipsRestP = dst.tpose.get(dstHips).p;
  const hipScale = opts.hipScale != null ? opts.hipScale : (dstHipsRestP.y / Math.max(1e-6, srcHipsRestP.y));

  // Map from dst bone name to its parent chain world rotation during retarget
  for (let f = 0; f < frames; f++) {
    const t = f * dt;
    times[f] = t;

    // 1) source pose at t (local overrides)
    const pose = new Map();
    for (const [boneName, tracks] of clip.channels) {
      const o = {};
      if (tracks.rot) o.r = sampleQuat(tracks.rot, t, new Quaternion());
      if (tracks.pos) o.t = sampleVec(tracks.pos, t, new Vector3());
      pose.set(boneName, o);
    }
    const srcWorld = computeWorld(src.skel, pose);

    // 2) desired dst world rotations; compute locals top-down
    const dstWorldR = new Map(); // dstBoneName -> Quaternion world
    for (const name of dst.skel.order) {
      const b = dst.skel.bones.get(name);
      const sem = semOf(dst.rigMap, name);
      let wr;
      if (sem && offsets.has(sem) && srcWorld.has(src.rigMap[sem])) {
        wr = srcWorld.get(src.rigMap[sem]).r.clone().multiply(offsets.get(sem));
      } else {
        // unmapped: keep rest local orientation under animated parent
        const parentWR = b.parentName ? dstWorldR.get(b.parentName) : null;
        if (parentWR) {
          const parentRestWR = dstRestWorld.get(b.parentName).r;
          const localRest = parentRestWR.clone().invert().multiply(dstRestWorld.get(name).r);
          wr = parentWR.clone().multiply(localRest);
        } else {
          wr = dstRestWorld.get(name).r.clone();
        }
      }
      dstWorldR.set(name, wr);

      const store = outRot.get(name);
      if (store) {
        const parentWR = b.parentName ? dstWorldR.get(b.parentName) : new Quaternion();
        q.copy(parentWR).invert().multiply(wr);
        store[f * 4] = q.x; store[f * 4 + 1] = q.y; store[f * 4 + 2] = q.z; store[f * 4 + 3] = q.w;
      }
    }

    // 3) hips position: scale source hips world position, convert to dst-local
    const sHipsW = srcWorld.get(srcHips).p;
    // source rest hips (base pose) world:
    v.set(
      (sHipsW.x - srcHipsRestP.x) * hipScale * (opts.mirrorX ? -1 : 1) + dstHipsRestP.x,
      sHipsW.y * hipScale,
      (sHipsW.z - srcHipsRestP.z) * hipScale + dstHipsRestP.z,
    );
    // convert world position to local under dst hips parent (rest transform of parents,
    // assuming ancestors of hips are static — true for Bip01/root nodes)
    const hb = dst.skel.bones.get(dstHips);
    let local = v.clone();
    if (hb.parentName) {
      const pm = dstRestWorld.get(hb.parentName).m.clone().invert();
      local.applyMatrix4(pm);
    }
    hipPos[f * 3] = local.x; hipPos[f * 3 + 1] = local.y; hipPos[f * 3 + 2] = local.z;
  }

  return { name: clip.name, times, rotTracks: outRot, hipBone: dstHips, hipPos };
}

function semOf(rigMap, boneName) {
  for (const sem in rigMap) if (rigMap[sem] === boneName) return sem;
  return null;
}
