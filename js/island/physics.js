import { KILL_Y, platformsFor } from "./world-data.js";

export const MOVE_SPEED = 5.35;
export const GROUND_ACCEL = 42;
export const AIR_ACCEL = 17;
export const JUMP_SPEED = 8.35;
export const GRAVITY = 22;
export const MAX_FALL = 24;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER = 0.12;
export const PLAYER_RADIUS = 0.34;

function approach(value, target, maxDelta) {
  if (value < target) return Math.min(target, value + maxDelta);
  if (value > target) return Math.max(target, value - maxDelta);
  return target;
}

function overlapsPlatform(body, platform, margin = 0.08) {
  return (
    Math.abs(body.x - platform.x) <= platform.w / 2 + margin &&
    Math.abs(body.z - platform.z) <= platform.d / 2 + margin
  );
}

export function createBody(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
  };
}

export function supportHeight(body, platforms) {
  let top = null;
  for (const platform of platforms) {
    if (!overlapsPlatform(body, platform, 0.1)) continue;
    if (Math.abs(body.y - platform.top) <= 0.09 && (top === null || platform.top > top)) {
      top = platform.top;
    }
  }
  return top;
}

function findLanding(body, previousY, platforms) {
  let landing = null;
  for (const platform of platforms) {
    if (!overlapsPlatform(body, platform, 0.13)) continue;
    const crossed = previousY >= platform.top - 0.075 && body.y <= platform.top + 0.001;
    if (!crossed) continue;
    if (!landing || platform.top > landing.top) landing = platform;
  }
  return landing;
}

export function stepBody(body, input, platforms, dt) {
  const step = Math.min(0.033, Math.max(0.001, Number(dt) || 1 / 60));
  const activePlatforms = Array.isArray(input.platforms)
    ? input.platforms
    : (Array.isArray(platforms) ? platforms : platformsFor(Boolean(input.doorOpen)));
  if (body.grounded && supportHeight(body, activePlatforms) === null) {
    body.grounded = false;
  }

  if (input.jump) body.jumpBuffer = JUMP_BUFFER;
  else body.jumpBuffer = Math.max(0, body.jumpBuffer - step);

  if (body.grounded) body.coyote = COYOTE_TIME;
  else body.coyote = Math.max(0, body.coyote - step);

  if (body.jumpBuffer > 0 && body.coyote > 0) {
    body.vy = JUMP_SPEED;
    body.grounded = false;
    body.coyote = 0;
    body.jumpBuffer = 0;
  }

  let inputX = Number(input.x) || 0;
  let inputZ = Number(input.z) || 0;
  const magnitude = Math.hypot(inputX, inputZ);
  if (magnitude > 1) {
    inputX /= magnitude;
    inputZ /= magnitude;
  }

  const accel = body.grounded ? GROUND_ACCEL : AIR_ACCEL;
  body.vx = approach(body.vx, inputX * MOVE_SPEED, accel * step);
  body.vz = approach(body.vz, inputZ * MOVE_SPEED, accel * step);

  if (!body.grounded) {
    body.vy = Math.max(-MAX_FALL, body.vy - GRAVITY * step);
  }

  body.x += body.vx * step;
  body.z += body.vz * step;
  body.x = Math.min(17, Math.max(-17, body.x));
  body.z = Math.min(20, Math.max(-76, body.z));

  const previousY = body.y;
  body.y += body.vy * step;

  if (body.vy <= 0) {
    const landing = findLanding(body, previousY, activePlatforms);
    if (landing) {
      body.y = landing.top;
      body.vy = 0;
      body.grounded = true;
      return { landed: true, fell: false };
    }
  }

  if (body.y < KILL_Y) return { landed: false, fell: true };
  return { landed: false, fell: false };
}

export function poseOf(body) {
  return {
    x: body.x,
    y: body.y,
    z: body.z,
    yaw: body.yaw,
    grounded: body.grounded,
  };
}
