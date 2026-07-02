// Skeleton extraction + animation sampling from glTF documents (gltf-transform),
// with three.js math. Used by the offline retarget pipeline only.
import { Quaternion, Vector3, Matrix4 } from 'three';

export function sanitizeName(name) {
  // Match THREE.PropertyBinding.sanitizeNodeName: spaces -> underscore,
  // then strip characters that PropertyBinding cannot parse.
  return name.replace(/\s/g, '_').replace(/[^\w-]/g, '');
}

// Build a skeleton description from a gltf-transform Document.
// Returns { bones: Map<name, {name, parent, t: Vector3, r: Quaternion, s: Vector3, node}> , order: [names in top-down order], root }
export function extractSkeleton(doc) {
  const bones = new Map();
  const parentOf = new Map();
  for (const node of doc.getRoot().listNodes()) {
    for (const child of node.listChildren()) parentOf.set(child, node);
  }
  const nodes = doc.getRoot().listNodes();
  for (const node of nodes) {
    const name = node.getName();
    const t = node.getTranslation(), r = node.getRotation(), s = node.getScale();
    const parent = parentOf.get(node) || null;
    bones.set(name, {
      name,
      parentName: parent ? parent.getName() : null,
      t: new Vector3(...t),
      r: new Quaternion(...r),
      s: new Vector3(...s),
      node,
    });
  }
  // top-down order (parents before children)
  const order = [];
  const visited = new Set();
  const visit = (name) => {
    if (visited.has(name)) return;
    const b = bones.get(name);
    if (b && b.parentName && bones.has(b.parentName)) visit(b.parentName);
    visited.add(name);
    order.push(name);
  };
  for (const name of bones.keys()) visit(name);
  return { bones, order };
}

// Compute world (model-space) matrices for a pose.
// pose: Map<boneName, {r?: Quaternion, t?: Vector3}> overrides of local TRS. Missing => rest.
export function computeWorld(skel, pose = new Map()) {
  const world = new Map(); // name -> {m: Matrix4, r: Quaternion, p: Vector3}
  const tmpM = new Matrix4();
  for (const name of skel.order) {
    const b = skel.bones.get(name);
    const o = pose.get(name) || {};
    const r = o.r || b.r, t = o.t || b.t, s = b.s;
    tmpM.compose(t, r, s);
    const local = tmpM.clone();
    let m;
    if (b.parentName && world.has(b.parentName)) {
      m = world.get(b.parentName).m.clone().multiply(local);
    } else {
      m = local;
    }
    const wr = new Quaternion(), wp = new Vector3(), ws = new Vector3();
    m.decompose(wp, wr, ws);
    world.set(name, { m, r: wr, p: wp, s: ws });
  }
  return world;
}

// Extract animation clips from a document.
// Returns [{name, duration, channels: Map<boneName, {rot?: {times, values}, pos?: {times, values}}>}]
export function extractClips(doc) {
  const clips = [];
  for (const anim of doc.getRoot().listAnimations()) {
    const channels = new Map();
    let duration = 0;
    for (const ch of anim.listChannels()) {
      const node = ch.getTargetNode();
      const path = ch.getTargetPath(); // 'translation' | 'rotation' | 'scale'
      if (!node) continue;
      const sampler = ch.getSampler();
      if (!sampler) continue;
      const times = Array.from(sampler.getInput().getArray());
      let values = Array.from(sampler.getOutput().getArray());
      const interp = sampler.getInterpolation();
      if (interp === 'CUBICSPLINE') {
        // keep only the value elements (in-tangent, value, out-tangent triplets)
        const el = path === 'rotation' ? 4 : 3;
        const v = [];
        for (let i = 0; i < times.length; i++) {
          for (let k = 0; k < el; k++) v.push(values[(i * 3 + 1) * el + k]);
        }
        values = v;
      }
      duration = Math.max(duration, times[times.length - 1] || 0);
      const name = node.getName();
      if (!channels.has(name)) channels.set(name, {});
      const slot = channels.get(name);
      if (path === 'rotation') slot.rot = { times, values };
      else if (path === 'translation') slot.pos = { times, values };
    }
    clips.push({ name: anim.getName(), duration, channels });
  }
  return clips;
}

function findKey(times, t) {
  let lo = 0, hi = times.length - 1;
  if (t <= times[0]) return [0, 0, 0];
  if (t >= times[hi]) return [hi, hi, 0];
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid; else hi = mid;
  }
  const span = times[hi] - times[lo];
  const alpha = span > 0 ? (t - times[lo]) / span : 0;
  return [lo, hi, alpha];
}

export function sampleQuat(track, t, out) {
  const { times, values } = track;
  const [i0, i1, a] = findKey(times, t);
  const q0 = new Quaternion(values[i0 * 4], values[i0 * 4 + 1], values[i0 * 4 + 2], values[i0 * 4 + 3]);
  if (i0 === i1) return out.copy(q0);
  const q1 = new Quaternion(values[i1 * 4], values[i1 * 4 + 1], values[i1 * 4 + 2], values[i1 * 4 + 3]);
  return out.copy(q0).slerp(q1, a);
}

export function sampleVec(track, t, out) {
  const { times, values } = track;
  const [i0, i1, a] = findKey(times, t);
  const v0 = new Vector3(values[i0 * 3], values[i0 * 3 + 1], values[i0 * 3 + 2]);
  if (i0 === i1) return out.copy(v0);
  const v1 = new Vector3(values[i1 * 3], values[i1 * 3 + 1], values[i1 * 3 + 2]);
  return out.copy(v0).lerp(v1, a);
}
