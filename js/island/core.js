import {
  CHECKPOINT,
  CHECKPOINT_SPAWN_POINTS,
  GOAL,
  KILL_Y,
  SPAWN_POINTS,
  SWITCHES,
} from "./world-data.js";

export const MAX_ISLAND_PLAYERS = 4;
export const SWITCH_SECONDS = 2.2;
export const PLAYER_COLORS = [
  { hex: "#d9573c", soft: "#f5d4c9", name: "San hô" },
  { hex: "#1f7a68", soft: "#c9e5dc", name: "Rêu" },
  { hex: "#d9a52c", soft: "#f5e2ae", name: "Nắng" },
  { hex: "#3d6fa8", soft: "#d2e1f1", name: "Biển" },
];

const COLOR_BY_NAME = new Map(PLAYER_COLORS.map((color) => [color.hex, color]));

export function sanitizeIslandName(value, fallback = "Người chơi") {
  const text = String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(text);
  return chars.length ? chars.slice(0, 18).join("") : fallback;
}

export function initialsOf(name) {
  const parts = sanitizeIslandName(name, "?").split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (Array.from(parts[0])[0] + Array.from(parts[parts.length - 1])[0]).toUpperCase();
  }
  return Array.from(parts[0] || "?").slice(0, 2).join("").toUpperCase();
}

function playerList(state) {
  return Object.values(state.players);
}

function spawnIndexOf(state, id) {
  const index = Object.keys(state.players).indexOf(id);
  return index >= 0 ? index % SPAWN_POINTS.length : 0;
}

function nextColor(state) {
  const taken = new Set(playerList(state).map((player) => player.color));
  return PLAYER_COLORS.find((color) => !taken.has(color.hex)) ?? PLAYER_COLORS[0];
}

function poseAt(point, yaw = 0) {
  return {
    x: point.x,
    y: point.y,
    z: point.z,
    yaw,
    grounded: true,
  };
}

function makePlayer(state, { id, name, now }) {
  const color = nextColor(state);
  const spawn = SPAWN_POINTS[Object.keys(state.players).length % SPAWN_POINTS.length];
  return {
    id,
    name: sanitizeIslandName(name),
    color: color.hex,
    colorName: color.name,
    host: id === state.hostId,
    joinedAt: now,
    ...poseAt(spawn),
    atGoal: false,
  };
}

export function createIslandState({ hostId, hostName, now = Date.now() }) {
  const state = {
    version: 1,
    phase: "lobby",
    hostId,
    practice: false,
    players: {},
    switches: { a: [], b: [], charge: 0, open: false },
    checkpoint: false,
    startedAt: null,
    finishedAt: null,
    finishReason: null,
    snapshotSeq: 0,
  };
  state.players[hostId] = makePlayer(state, { id: hostId, name: hostName, now });
  return state;
}

export function addPlayer(state, { id, name, now = Date.now() }) {
  if (!id) return { ok: false, reason: "Thiếu mã người chơi." };
  if (state.phase !== "lobby") {
    return { ok: false, reason: "Ván đang diễn ra. Hãy chờ chủ phòng mở ván mới." };
  }
  if (state.players[id]) return { ok: false, reason: "Bạn đã ở trong phòng này." };
  if (playerList(state).length >= MAX_ISLAND_PLAYERS) {
    return { ok: false, reason: "Phòng đã đủ 4 người." };
  }
  const player = makePlayer(state, { id, name, now });
  state.players[id] = player;
  return { ok: true, player };
}

export function removePlayer(state, id) {
  const player = state.players[id];
  if (!player) return null;
  delete state.players[id];
  // A disconnected teammate must never leave a solo survivor trapped.
  if (state.phase === "playing" && playerList(state).length < 2) {
    state.practice = true;
    state.switches.open = true;
  }
  state.switches.a = state.switches.a.filter((pressedId) => pressedId !== id);
  state.switches.b = state.switches.b.filter((pressedId) => pressedId !== id);
  for (const current of playerList(state)) {
    if (current.host) return player;
  }
  return player;
}

export function chooseSpawn(state, id) {
  const index = spawnIndexOf(state, id);
  const points = state.checkpoint ? CHECKPOINT_SPAWN_POINTS : SPAWN_POINTS;
  return points[index % points.length];
}

export function resetToLobby(state) {
  state.phase = "lobby";
  state.practice = false;
  state.startedAt = null;
  state.finishedAt = null;
  state.finishReason = null;
  state.switches = { a: [], b: [], charge: 0, open: false };
  state.checkpoint = false;
  const players = playerList(state);
  players.forEach((player, index) => {
    Object.assign(player, poseAt(SPAWN_POINTS[index % SPAWN_POINTS.length]), { atGoal: false });
  });
  return { ok: true };
}

export function startGame(state, now = Date.now()) {
  const players = playerList(state);
  if (!players.length) return { ok: false, reason: "Chưa có người chơi trong phòng." };
  if (state.phase === "playing") return { ok: false, reason: "Ván đang diễn ra." };
  state.phase = "playing";
  state.practice = players.length === 1;
  state.startedAt = now;
  state.finishedAt = null;
  state.finishReason = null;
  state.switches = { a: [], b: [], charge: 0, open: state.practice };
  state.checkpoint = false;
  players.forEach((player, index) => {
    Object.assign(player, poseAt(SPAWN_POINTS[index % SPAWN_POINTS.length]), { atGoal: false });
  });
  return { ok: true, practice: state.practice };
}

export function elapsedSeconds(state, now = Date.now()) {
  if (!state.startedAt) return 0;
  const end = state.finishedAt ?? now;
  return Math.max(0, (end - state.startedAt) / 1000);
}

export function sanitizePose(value, current) {
  if (!value || typeof value !== "object") return null;
  const number = (candidate, fallback, min, max) => {
    const parsed = Number(candidate);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };
  const yaw = number(value.yaw, current?.yaw ?? 0, -Math.PI * 8, Math.PI * 8);
  return {
    x: number(value.x, current?.x ?? 0, -18, 18),
    y: number(value.y, current?.y ?? 0, -16, 28),
    z: number(value.z, current?.z ?? 10, -78, 22),
    yaw,
    grounded: Boolean(value.grounded),
  };
}

export function updatePose(state, id, value) {
  const player = state.players[id];
  if (!player) return false;
  const pose = sanitizePose(value, player);
  if (!pose) return false;
  Object.assign(player, pose);
  return true;
}

export function respawnPlayer(state, id) {
  const player = state.players[id];
  if (!player) return null;
  const spawn = chooseSpawn(state, id);
  Object.assign(player, poseAt(spawn, player.yaw ?? 0));
  return spawn;
}

function playerNearSwitch(player, sw) {
  const dx = player.x - sw.x;
  const dz = player.z - sw.z;
  return dx * dx + dz * dz <= sw.radius * sw.radius && Math.abs(player.y - sw.y) < 1.8;
}

function playerNearCheckpoint(player) {
  const dx = player.x - CHECKPOINT.x;
  const dz = player.z - CHECKPOINT.z;
  return dx * dx + dz * dz <= CHECKPOINT.radius * CHECKPOINT.radius && Math.abs(player.y - CHECKPOINT.y) < 3;
}

function playerNearGoal(player) {
  const dx = player.x - GOAL.x;
  const dz = player.z - GOAL.z;
  return dx * dx + dz * dz <= GOAL.radius * GOAL.radius && player.y > GOAL.y - 2.2 && player.y < GOAL.y + 4.5;
}

export function tickGame(state, now = Date.now(), dt = 0) {
  const events = [];
  if (state.phase !== "playing") return events;
  const players = playerList(state);
  const step = Math.min(0.1, Math.max(0, Number(dt) || 0));

  for (const player of players) {
    if (player.y < KILL_Y) {
      const spawn = chooseSpawn(state, player.id);
      Object.assign(player, poseAt(spawn, player.yaw ?? 0));
      events.push({ type: "respawn", playerId: player.id, name: player.name });
    }
  }

  const pressedA = players.filter((player) => playerNearSwitch(player, SWITCHES[0])).map((player) => player.id);
  const pressedB = players.filter((player) => playerNearSwitch(player, SWITCHES[1])).map((player) => player.id);
  state.switches.a = pressedA;
  state.switches.b = pressedB;
  state.switches.cooperation = pressedA.some((a) => pressedB.some((b) => a !== b));

  if (!state.switches.open) {
    if (state.switches.cooperation) {
      state.switches.charge = Math.min(SWITCH_SECONDS, state.switches.charge + step);
      if (state.switches.charge >= SWITCH_SECONDS) {
        state.switches.open = true;
        events.push({ type: "door" });
      }
    } else {
      state.switches.charge = Math.max(0, state.switches.charge - step * 1.8);
    }
  }

  if (state.switches.open && !state.checkpoint && players.some(playerNearCheckpoint)) {
    state.checkpoint = true;
    events.push({ type: "checkpoint" });
  }

  for (const player of players) {
    if (state.checkpoint && !player.atGoal && playerNearGoal(player)) {
      player.atGoal = true;
      player.arrivedAt = now;
      events.push({ type: "arrive", playerId: player.id, name: player.name });
    }
  }

  if (players.length && players.every((player) => player.atGoal)) {
    state.phase = "ended";
    state.finishedAt = now;
    state.finishReason = state.practice ? "practice" : "coop";
    events.push({
      type: "finish",
      practice: state.practice,
      elapsed: elapsedSeconds(state, now),
    });
  }

  return events;
}

export function serializeState(state, now = Date.now()) {
  const players = playerList(state).map((player) => ({
    id: player.id,
    name: player.name,
    color: player.color,
    colorName: player.colorName,
    host: player.host,
    x: player.x,
    y: player.y,
    z: player.z,
    yaw: player.yaw,
    grounded: player.grounded,
    atGoal: player.atGoal,
  }));
  return {
    version: state.version,
    phase: state.phase,
    hostId: state.hostId,
    practice: state.practice,
    players,
    switches: {
      a: [...state.switches.a],
      b: [...state.switches.b],
      charge: state.switches.charge,
      open: state.switches.open,
      cooperation: Boolean(state.switches.cooperation),
    },
    checkpoint: state.checkpoint,
    elapsed: elapsedSeconds(state, now),
    finishReason: state.finishReason,
    snapshotSeq: ++state.snapshotSeq,
  };
}

export function colorFor(hex) {
  return COLOR_BY_NAME.get(hex) ?? PLAYER_COLORS[0];
}

export function roomReadiness(state) {
  const count = playerList(state).length;
  return {
    count,
    canStart: count >= 1 && state.phase !== "playing",
    practice: count === 1,
    maxed: count >= MAX_ISLAND_PLAYERS,
    label:
      count === 1
        ? "1 người · sẽ mở chế độ luyện tập"
        : `${count}/${MAX_ISLAND_PLAYERS} người · thử thách phối hợp`,
  };
}
