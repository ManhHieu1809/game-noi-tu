export const KILL_Y = -14;
export const START_TOP = 0;
export const SWITCH_TOP = 1.4;
export const CHECKPOINT_TOP = 1.4;
export const GOAL_TOP = 2;
export const BRIDGE_ID = "bridge";

export const PLATFORMS = [
  { id: "start", kind: "start", x: 0, z: 10, top: 0, w: 14, d: 14, thickness: 3.2 },
  { id: "stone-1", kind: "stone", x: 0, z: 0.8, top: 0.55, w: 4.6, d: 4.2, thickness: 1.3 },
  { id: "stone-2", kind: "stone", x: -3.1, z: -5.4, top: 1.05, w: 4.2, d: 4.2, thickness: 1.3 },
  { id: "stone-3", kind: "stone", x: 2.5, z: -11.5, top: 0.8, w: 4.4, d: 4.2, thickness: 1.3 },
  { id: "stone-4", kind: "stone", x: 0, z: -17.3, top: 1.2, w: 5.1, d: 4.5, thickness: 1.4 },
  { id: "switch-deck", kind: "switch", x: 0, z: -24, top: 1.4, w: 15, d: 9, thickness: 3.6 },
  { id: "checkpoint-deck", kind: "checkpoint", x: 0, z: -40, top: 1.4, w: 12.5, d: 10, thickness: 3.8 },
  { id: "stone-5", kind: "stone", x: 0, z: -50, top: 1.9, w: 4.8, d: 4.4, thickness: 1.4 },
  { id: "stone-6", kind: "stone", x: 3.1, z: -56, top: 2.5, w: 4.2, d: 4.2, thickness: 1.4 },
  { id: "goal-deck", kind: "goal", x: 0, z: -64, top: 2, w: 16, d: 12, thickness: 4.2 },
];

export const BRIDGE = {
  id: BRIDGE_ID,
  kind: "bridge",
  x: 0,
  z: -32,
  top: 1.4,
  w: 4.6,
  d: 7.2,
  thickness: 0.48,
};

export const SPAWN_POINTS = [
  { x: -1.8, y: 0.03, z: 12.4 },
  { x: 1.8, y: 0.03, z: 12.4 },
  { x: -1.8, y: 0.03, z: 9.7 },
  { x: 1.8, y: 0.03, z: 9.7 },
];

export const CHECKPOINT_SPAWN_POINTS = [
  { x: -1.7, y: CHECKPOINT_TOP + 0.03, z: -38.1 },
  { x: 1.7, y: CHECKPOINT_TOP + 0.03, z: -38.1 },
  { x: -1.7, y: CHECKPOINT_TOP + 0.03, z: -40.4 },
  { x: 1.7, y: CHECKPOINT_TOP + 0.03, z: -40.4 },
];

export const SWITCHES = [
  { id: "a", x: -3.7, y: SWITCH_TOP, z: -24, radius: 1.25 },
  { id: "b", x: 3.7, y: SWITCH_TOP, z: -24, radius: 1.25 },
];

export const CHECKPOINT = {
  x: 0,
  y: CHECKPOINT_TOP,
  z: -40,
  radius: 2.55,
};

export const GOAL = {
  x: 0,
  y: GOAL_TOP,
  z: -64.8,
  radius: 5.1,
};

export const DECOR = {
  startTrees: [
    { x: -5.2, z: 13.8, scale: 1.1, variant: 0 },
    { x: 5.3, z: 7.2, scale: 0.9, variant: 1 },
  ],
  switchTrees: [
    { x: -6.2, z: -27.4, scale: 0.75, variant: 1 },
    { x: 6.1, z: -20.6, scale: 0.9, variant: 0 },
  ],
  checkpointTrees: [
    { x: -5.1, z: -43.8, scale: 0.8, variant: 0 },
    { x: 5.3, z: -36.8, scale: 0.7, variant: 1 },
  ],
  goalTrees: [
    { x: -6.4, z: -67.2, scale: 1.15, variant: 0 },
    { x: 6.2, z: -60.3, scale: 0.95, variant: 1 },
    { x: 6.4, z: -68.2, scale: 0.8, variant: 2 },
  ],
  flowers: [
    { x: -4.1, z: 7.6, color: 0 },
    { x: 4.4, z: 14.1, color: 1 },
    { x: 3.9, z: 8.4, color: 2 },
    { x: -5.3, z: 9.6, color: 1 },
    { x: -4.6, z: -21.1, color: 2 },
    { x: 4.9, z: -26.2, color: 0 },
    { x: -4.2, z: -36.3, color: 1 },
    { x: 4.2, z: -43.2, color: 0 },
    { x: -5.2, z: -60.1, color: 2 },
    { x: 4.7, z: -68.4, color: 1 },
  ],
};

export function platformsFor(doorOpen) {
  return doorOpen ? [...PLATFORMS, BRIDGE] : PLATFORMS;
}

export function platformById(id, doorOpen = false) {
  if (id === BRIDGE_ID) return doorOpen ? BRIDGE : null;
  return PLATFORMS.find((platform) => platform.id === id) ?? null;
}

export function surfaceAt(x, z, fromY = 30, platforms = PLATFORMS) {
  let best = null;
  for (const platform of platforms) {
    if (Math.abs(x - platform.x) > platform.w / 2 + 0.22) continue;
    if (Math.abs(z - platform.z) > platform.d / 2 + 0.22) continue;
    if (platform.top > fromY + 0.15) continue;
    if (!best || platform.top > best.top) best = platform;
  }
  return best;
}
