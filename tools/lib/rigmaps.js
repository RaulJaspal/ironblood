// Semantic joint -> bone name maps for each rig convention.

// Quaternius Universal Animation Library (UE-mannequin style names)
export const UAL_MAP = {
  hips: 'pelvis',
  spine: 'spine_01', spine1: 'spine_02', spine2: 'spine_03',
  neck: 'neck_01', head: 'Head',
  lShoulder: 'clavicle_l', lUpperArm: 'upperarm_l', lForeArm: 'lowerarm_l', lHand: 'hand_l',
  rShoulder: 'clavicle_r', rUpperArm: 'upperarm_r', rForeArm: 'lowerarm_r', rHand: 'hand_r',
  lThigh: 'thigh_l', lCalf: 'calf_l', lFoot: 'foot_l', lToe: 'ball_l',
  rThigh: 'thigh_r', rCalf: 'calf_r', rFoot: 'foot_r', rToe: 'ball_r',
  lThumb1: 'thumb_01_l', lThumb2: 'thumb_02_l', lThumb3: 'thumb_03_l',
  lIndex1: 'index_01_l', lIndex2: 'index_02_l', lIndex3: 'index_03_l',
  lMiddle1: 'middle_01_l', lMiddle2: 'middle_02_l', lMiddle3: 'middle_03_l',
  lRing1: 'ring_01_l', lRing2: 'ring_02_l', lRing3: 'ring_03_l',
  lPinky1: 'pinky_01_l', lPinky2: 'pinky_02_l', lPinky3: 'pinky_03_l',
  rThumb1: 'thumb_01_r', rThumb2: 'thumb_02_r', rThumb3: 'thumb_03_r',
  rIndex1: 'index_01_r', rIndex2: 'index_02_r', rIndex3: 'index_03_r',
  rMiddle1: 'middle_01_r', rMiddle2: 'middle_02_r', rMiddle3: 'middle_03_r',
  rRing1: 'ring_01_r', rRing2: 'ring_02_r', rRing3: 'ring_03_r',
  rPinky1: 'pinky_01_r', rPinky2: 'pinky_02_r', rPinky3: 'pinky_03_r',
};

// Microsoft Rocketbox (3ds Max Biped names). NOTE: names here are the
// PropertyBinding-sanitized versions (spaces -> underscores) — the character
// build step renames the nodes to match.
export const BIPED_MAP = {
  hips: 'Bip01_Pelvis',
  spine: 'Bip01_Spine', spine1: 'Bip01_Spine1', spine2: 'Bip01_Spine2',
  neck: 'Bip01_Neck', head: 'Bip01_Head',
  lShoulder: 'Bip01_L_Clavicle', lUpperArm: 'Bip01_L_UpperArm', lForeArm: 'Bip01_L_Forearm', lHand: 'Bip01_L_Hand',
  rShoulder: 'Bip01_R_Clavicle', rUpperArm: 'Bip01_R_UpperArm', rForeArm: 'Bip01_R_Forearm', rHand: 'Bip01_R_Hand',
  lThigh: 'Bip01_L_Thigh', lCalf: 'Bip01_L_Calf', lFoot: 'Bip01_L_Foot', lToe: 'Bip01_L_Toe0',
  rThigh: 'Bip01_R_Thigh', rCalf: 'Bip01_R_Calf', rFoot: 'Bip01_R_Foot', rToe: 'Bip01_R_Toe0',
  lThumb1: 'Bip01_L_Finger0', lThumb2: 'Bip01_L_Finger01', lThumb3: 'Bip01_L_Finger02',
  lIndex1: 'Bip01_L_Finger1', lIndex2: 'Bip01_L_Finger11', lIndex3: 'Bip01_L_Finger12',
  lMiddle1: 'Bip01_L_Finger2', lMiddle2: 'Bip01_L_Finger21', lMiddle3: 'Bip01_L_Finger22',
  lRing1: 'Bip01_L_Finger3', lRing2: 'Bip01_L_Finger31', lRing3: 'Bip01_L_Finger32',
  lPinky1: 'Bip01_L_Finger4', lPinky2: 'Bip01_L_Finger41', lPinky3: 'Bip01_L_Finger42',
  rThumb1: 'Bip01_R_Finger0', rThumb2: 'Bip01_R_Finger01', rThumb3: 'Bip01_R_Finger02',
  rIndex1: 'Bip01_R_Finger1', rIndex2: 'Bip01_R_Finger11', rIndex3: 'Bip01_R_Finger12',
  rMiddle1: 'Bip01_R_Finger2', rMiddle2: 'Bip01_R_Finger21', rMiddle3: 'Bip01_R_Finger22',
  rRing1: 'Bip01_R_Finger3', rRing2: 'Bip01_R_Finger31', rRing3: 'Bip01_R_Finger32',
  rPinky1: 'Bip01_R_Finger4', rPinky2: 'Bip01_R_Finger41', rPinky3: 'Bip01_R_Finger42',
};
