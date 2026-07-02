// Bake UAL (CC0) animation clips onto the Rocketbox Biped skeletons.
// Outputs web/assets/anims/anims_male.glb and anims_female.glb
import { NodeIO, Document } from '@gltf-transform/core';
import { Quaternion, Vector3 } from 'three';
import { extractSkeleton, extractClips, sanitizeName, computeWorld } from './lib/skeleton.js';
import { computeTPoseWorld, retargetClip } from './lib/retarget.js';
import { UAL_MAP, BIPED_MAP } from './lib/rigmaps.js';
import { buildKeyframedClips } from './lib/moves.js';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(url.fileURLToPath(import.meta.url));
const io = new NodeIO();

// clip selection: sourceName -> outputName
const UAL1_CLIPS = {
  Idle_Loop: 'idle_relaxed',
  Idle_Talking_Loop: 'select_idle',
  Walk_Loop: 'walk',
  Jog_Fwd_Loop: 'jog',
  Sprint_Loop: 'dash',
  Crouch_Idle_Loop: 'crouch',
  Crouch_Fwd_Loop: 'crouch_walk',
  Jump_Start: 'jump_start', Jump_Loop: 'jump_loop', Jump_Land: 'jump_land',
  Roll: 'roll',
  Punch_Jab: 'jab',
  Punch_Cross: 'cross',
  Hit_Chest: 'hit_body', Hit_Head: 'hit_head',
  Death01: 'ko',
  Dance_Loop: 'victory_dance',
  Spell_Simple_Shoot: 'fireball',
  Spell_Simple_Idle_Loop: 'focus_idle',
  Sword_Attack: 'heavy_slash',
};
const UAL2_CLIPS = {
  Melee_Hook: 'hook', Melee_Hook_Rec: 'hook_rec',
  Hit_Knockback: 'launched',
  Sword_Block: 'block',
  Sword_Regular_A: 'strike_a', Sword_Regular_A_Rec: 'strike_a_rec',
  Sword_Regular_B: 'strike_b', Sword_Regular_B_Rec: 'strike_b_rec',
  Sword_Regular_C: 'strike_c',
  Sword_Heavy_Combo: 'super_combo',
  Shield_Dash: 'shoulder_charge',
  Slide_Start: 'slide_start', Slide_Loop: 'slide_loop', Slide_Exit: 'slide_exit',
  OverhandThrow: 'overhand_throw',
  Yes: 'victory_yes',
  Idle_No_Loop: 'taunt',
  Idle_FoldArms_Loop: 'select_pose',
  NinjaJump_Start: 'flip_jump',
};

// --- load UAL sources ---
async function loadUAL(file) {
  const doc = await io.read(file);
  const skel = extractSkeleton(doc);
  const clips = extractClips(doc);
  // base pose: A_TPose clip at t=0 (rig rest is A-pose)
  const tposeClip = clips.find((c) => c.name === 'A_TPose');
  const basePose = new Map();
  if (tposeClip) {
    for (const [bone, tr] of tposeClip.channels) {
      const o = {};
      if (tr.rot) { const q = new Quaternion(tr.rot.values[0], tr.rot.values[1], tr.rot.values[2], tr.rot.values[3]); o.r = q; }
      if (tr.pos) { o.t = new Vector3(tr.pos.values[0], tr.pos.values[1], tr.pos.values[2]); }
      basePose.set(bone, o);
    }
  }
  return { doc, skel, clips, basePose };
}

async function loadBiped(file) {
  const doc = await io.read(file);
  // sanitize node names to match runtime (spaces -> underscores)
  for (const n of doc.getRoot().listNodes()) n.setName(sanitizeName(n.getName()));
  const skel = extractSkeleton(doc);
  return { doc, skel };
}

function detectFacing(skel, boneName, basePose = new Map()) {
  // returns +1 if bone world x > 0 (left at +X -> facing +Z), else -1
  const world = computeWorld(skel, basePose);
  const w = world.get(boneName);
  return w && w.p.x > 0 ? 1 : -1;
}

function buildAnimDoc(dstSkel, results) {
  const doc = new Document();
  doc.createBuffer('b');
  const scene = doc.createScene('anims');
  const nodeByName = new Map();
  // recreate bone hierarchy (nodes only)
  for (const name of dstSkel.order) {
    const b = dstSkel.bones.get(name);
    const node = doc.createNode(name)
      .setTranslation(b.t.toArray())
      .setRotation([b.r.x, b.r.y, b.r.z, b.r.w])
      .setScale(b.s.toArray());
    nodeByName.set(name, node);
    if (b.parentName && nodeByName.has(b.parentName)) nodeByName.get(b.parentName).addChild(node);
    else scene.addChild(node);
  }
  for (const res of results) {
    const anim = doc.createAnimation(res.name);
    const timeAcc = doc.createAccessor().setType('SCALAR').setArray(res.times);
    for (const [boneName, rot] of res.rotTracks) {
      const node = nodeByName.get(boneName);
      if (!node) continue;
      const valAcc = doc.createAccessor().setType('VEC4').setArray(rot);
      const sampler = doc.createAnimationSampler().setInput(timeAcc).setOutput(valAcc).setInterpolation('LINEAR');
      const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath('rotation').setSampler(sampler);
      anim.addSampler(sampler).addChannel(channel);
    }
    if (res.hipPos) {
      const node = nodeByName.get(res.hipBone);
      const valAcc = doc.createAccessor().setType('VEC3').setArray(res.hipPos);
      const sampler = doc.createAnimationSampler().setInput(timeAcc).setOutput(valAcc).setInterpolation('LINEAR');
      const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(sampler);
      anim.addSampler(sampler).addChannel(channel);
    }
  }
  return doc;
}

async function main() {
  const ual1 = await loadUAL(path.join(ROOT, 'src/ual/UAL1_Standard.glb'));
  const ual2 = await loadUAL(path.join(ROOT, 'src/ual/UAL2_Standard.glb'));

  const targets = [
    { file: 'src/chars/brawler/brawler_raw.glb', out: 'anims_male.glb' },
    { file: 'src/chars/heroine/heroine_raw.glb', out: 'anims_female.glb' },
  ];

  for (const tgt of targets) {
    const biped = await loadBiped(path.join(ROOT, tgt.file));
    const dstFacing = detectFacing(biped.skel, BIPED_MAP.lUpperArm);
    const dst = {
      skel: biped.skel,
      rigMap: BIPED_MAP,
      tpose: computeTPoseWorld(biped.skel, BIPED_MAP, new Map(), dstFacing),
    };

    const results = [];
    for (const [ual, clipMap] of [[ual1, UAL1_CLIPS], [ual2, UAL2_CLIPS]]) {
      const srcFacing = detectFacing(ual.skel, UAL_MAP.lUpperArm, ual.basePose);
      const src = {
        skel: ual.skel,
        rigMap: UAL_MAP,
        tpose: computeTPoseWorld(ual.skel, UAL_MAP, ual.basePose, srcFacing),
      };
      for (const [srcName, outName] of Object.entries(clipMap)) {
        const clip = ual.clips.find((c) => c.name === srcName);
        if (!clip) { console.warn('missing clip', srcName); continue; }
        const res = retargetClip(src, dst, clip, { fps: 30 });
        res.name = outName;
        results.push(res);
        }
    }

    // hand-keyed moves (kicks, uppercut, guard stance, sweep), layered on the
    // mocap guard pose = frame 0 of the retargeted Melee_Hook clip
    const hook = results.find((r) => r.name === 'hook');
    const base = { rot: new Map(), hipPos: new Vector3() };
    for (const [bn, arr] of hook.rotTracks) {
      base.rot.set(bn, new Quaternion(arr[0], arr[1], arr[2], arr[3]));
    }
    base.hipPos.set(hook.hipPos[0], hook.hipPos[1], hook.hipPos[2]);
    results.push(...buildKeyframedClips(dst, base));

    const doc = buildAnimDoc(biped.skel, results);
    const outPath = path.join(ROOT, '../web/assets/anims', tgt.out);
    await io.write(outPath, doc);
    const { statSync } = await import('node:fs');
    console.log('wrote', outPath, (statSync(outPath).size / 1e6).toFixed(2) + 'MB', results.length, 'clips');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
