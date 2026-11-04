import {
  CHECKPOINT_SPAWN_POINTS,
  SPAWN_POINTS,
} from "./world-data.js";
import {
  colorFor,
  initialsOf,
  respawnPlayer,
  sanitizeIslandName,
  SWITCH_SECONDS,
} from "./core.js";
import {
  createIslandRoom,
  joinIslandRoom,
} from "./net.js";
import {
  createBody,
  poseOf,
  stepBody,
} from "./physics.js";
import {
  createCamera,
  createRenderer,
  IslandWorld,
} from "./scene.js";

const $ = (id) => document.getElementById(id);
const FIXED_STEP = 1 / 60;
const LS_NAME = "island.name";

const el = {
  header: $("islandHeader"),
  scene: $("islandScene"),
  entry: $("islandEntry"),
  room: $("islandRoom"),
  hud: $("islandHud"),
  result: $("islandResult"),
  closed: $("closedOverlay"),
  fatal: $("fatalOverlay"),
  loading: $("islandLoading"),
  netPill: $("islandNetPill"),
  netText: $("islandNetText"),
  nameInput: $("islandNameInput"),
  codeInput: $("islandCodeInput"),
  createBtn: $("createIslandBtn"),
  joinBtn: $("joinIslandBtn"),
  createError: $("createIslandError"),
  joinError: $("joinIslandError"),
  entryMode: $("entryModeHint"),
  helpBtn: $("islandHelpBtn"),
  hudHelpBtn: $("hudHelpBtn"),
  helpDialog: $("islandHelpDialog"),
  closeHelpBtn: $("closeIslandHelpBtn"),
  okHelpBtn: $("okIslandHelpBtn"),
  lobbyCode: $("lobbyCode"),
  lobbyCodeBtn: $("lobbyCodeBtn"),
  lobbyLink: $("lobbyLink"),
  copyLinkBtn: $("copyIslandLinkBtn"),
  lobbyCount: $("lobbyCount"),
  lobbyPlayers: $("lobbyPlayers"),
  lobbyMode: $("lobbyMode"),
  startBtn: $("startIslandBtn"),
  lobbyHint: $("lobbyHint"),
  lobbyWait: $("lobbyWait"),
  leaveLobbyBtn: $("leaveLobbyBtn"),
  leaveGameBtn: $("leaveGameBtn"),
  leaveGameLabel: $("leaveGameLabel"),
  hudObjective: $("hudObjective"),
  hudTimer: $("hudTimer"),
  switchA: $("hudSwitchA"),
  switchB: $("hudSwitchB"),
  progress: $("hudProgress"),
  checkpoint: $("hudCheckpoint"),
  hudPlayers: $("hudPlayers"),
  network: $("hudNetwork"),
  announcement: $("hudAnnouncement"),
  touch: $("touchControls"),
  joystick: $("joystick"),
  joystickStick: $("joystickStick"),
  jumpBtn: $("jumpBtn"),
  toasts: $("islandToasts"),
  resultKicker: $("resultKicker"),
  resultTitle: $("resultTitle"),
  resultSub: $("resultSub"),
  resultTime: $("resultTime"),
  resultPlayersCount: $("resultPlayersCount"),
  resultBridge: $("resultBridge"),
  resultPlayers: $("resultPlayers"),
  resultActions: $("resultActions"),
  resultNote: $("resultNote"),
  closedText: $("closedText"),
  closedHomeBtn: $("closedHomeBtn"),
  fatalText: $("fatalText"),
  fatalReloadBtn: $("fatalReloadBtn"),
  confirm: $("islandConfirm"),
  confirmKicker: $("confirmKicker"),
  confirmTitle: $("confirmTitle"),
  confirmText: $("confirmText"),
  confirmOk: $("confirmOkBtn"),
  confirmCancel: $("confirmCancelBtn"),
};

const app = {
  renderer: null,
  camera: null,
  world: null,
  role: null,
  host: null,
  client: null,
  playerId: null,
  code: null,
  name: "",
  mode: "entry",
  snapshot: null,
  previousSnapshot: null,
  snapshotAt: 0,
  body: null,
  localSpeed: 0,
  cameraYaw: 0,
  cameraPitch: 0.17,
  cameraReady: false,
  keys: new Set(),
  touchVector: { x: 0, z: 0 },
  joystickPointer: null,
  jumpQueued: false,
  accumulator: 0,
  lastFrame: 0,
  previewTime: 0,
  lastTimerAt: 0,
  lastHudAt: 0,
  dragging: null,
  pointerLocked: false,
  touchUi: false,
  confirmResolver: null,
  announceTimer: null,
  endedShown: false,
  closedHandled: false,
  disposed: false,
};

function isTextInput(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function saveName(name) {
  try {
    localStorage.setItem(LS_NAME, name);
  } catch {
    /* ignore */
  }
}

function loadName() {
  try {
    return localStorage.getItem(LS_NAME) || "";
  } catch {
    return "";
  }
}

function setEntryError(which, message) {
  if (which === "create") el.createError.textContent = message || "";
  else el.joinError.textContent = message || "";
}

function setEntryBusy(busy) {
  for (const [button, label] of [
    [el.createBtn, "Tạo phòng"],
    [el.joinBtn, "Vào"],
  ]) {
    button.disabled = busy;
    const span = button.querySelector("span");
    if (span) span.textContent = busy ? "Đang kết nối…" : label;
  }
}

function showToast(message, type = "info", duration = 3200) {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  const icon = document.createElement("span");
  icon.className = "toast__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "success" ? "✓" : type === "error" ? "!" : "i";
  const text = document.createElement("span");
  text.textContent = message;
  toast.append(icon, text);
  while (el.toasts.children.length >= 4) el.toasts.firstElementChild.remove();
  el.toasts.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function announce(message, duration = 2600) {
  if (!message) return;
  el.announcement.textContent = message;
  el.announcement.classList.add("is-visible");
  clearTimeout(app.announceTimer);
  app.announceTimer = setTimeout(() => {
    el.announcement.classList.remove("is-visible");
  }, duration);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function playerById(snapshot, id) {
  return (snapshot?.players ?? []).find((player) => player.id === id) ?? null;
}

function localSnapshotPlayer(snapshot = app.snapshot) {
  return playerById(snapshot, app.playerId);
}

function networkLabel(snapshot = app.snapshot) {
  const count = snapshot?.players?.length ?? 0;
  if (app.role === "host") return `Chủ phòng · ${count}/4`;
  return `P2P · ${count}/4`;
}

function updateNetPill(text, offline = false) {
  if (!text) {
    el.netPill.classList.add("hidden");
    return;
  }
  el.netPill.classList.remove("hidden");
  el.netText.textContent = text;
  el.netPill.classList.toggle("is-off", offline);
}

function inviteLink() {
  if (!app.code) return "";
  const url = new URL(window.location.href);
  url.hash = `p=${app.code}`;
  return url.toString();
}

async function copyText(text, successMessage) {
  if (!text) return;
  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      copied = document.execCommand("copy");
      area.remove();
    } catch {
      copied = false;
    }
  }
  showToast(
    copied ? successMessage : "Không sao chép được. Hãy chọn và sao chép thủ công.",
    copied ? "success" : "error"
  );
}

function readName() {
  const name = sanitizeIslandName(el.nameInput.value, "");
  if (!name) {
    setEntryError("create", "Hãy nhập tên của bạn trước đã.");
    setEntryError("join", "Hãy nhập tên của bạn trước đã.");
    el.nameInput.focus();
    return null;
  }
  el.nameInput.value = name;
  saveName(name);
  app.name = name;
  return name;
}

function setEntryVisible(visible) {
  el.entry.classList.toggle("hidden", !visible);
}

function showRoomScreen(snapshot) {
  if (app.mode !== "room") {
    app.mode = "room";
    app.body = null;
    el.room.classList.remove("hidden");
    el.hud.classList.add("hidden");
    el.result.classList.add("hidden");
    el.touch.classList.add("hidden");
    bodyMode("room");
    document.body.classList.add("island-in-room");
    document.body.classList.remove("island-playing", "island-locked");
    setEntryVisible(false);
    if (document.pointerLockElement) document.exitPointerLock();
  }
  renderLobby(snapshot);
}

function bodyMode(mode) {
  document.body.classList.toggle("island-playing", mode === "playing");
  document.body.classList.toggle("island-locked", mode === "playing" || mode === "ended");
}

function enterPlaying(snapshot) {
  const local = localSnapshotPlayer(snapshot);
  if (!local) return;
  app.mode = "playing";
  app.endedShown = false;
  app.closedHandled = false;
  app.accumulator = 0;
  app.jumpQueued = false;
  app.keys.clear();
  app.touchVector.x = 0;
  app.touchVector.z = 0;
  app.cameraYaw = 0;
  app.cameraPitch = 0.17;
  app.cameraReady = false;
  app.body = createBody({ x: local.x, y: local.y, z: local.z });
  app.body.grounded = true;
  app.body.yaw = Math.PI;
  el.room.classList.add("hidden");
  el.result.classList.add("hidden");
  el.hud.classList.remove("hidden");
  document.body.classList.add("island-in-room");
  bodyMode("playing");
  if (app.touchUi) el.touch.classList.remove("hidden");
  app.world.setLocalId(app.playerId);
  app.world.syncPlayers(snapshot);
  app.world.setViewState(snapshot);
  if (app.renderer) app.renderer.domElement.focus({ preventScroll: true });
  updateHud(snapshot);
  announce(
    snapshot.practice
      ? "Chế độ luyện tập · cầu mây đã mở sẵn. Hãy chạm mốc lưu rồi về đích."
      : "Cả nhóm xuất phát! Hai người cần đứng lên hai công tắc cùng lúc.",
    3600
  );
}

function enterEnded(snapshot) {
  if (app.endedShown) return;
  app.endedShown = true;
  app.mode = "ended";
  app.body = null;
  el.hud.classList.add("hidden");
  el.touch.classList.add("hidden");
  el.result.classList.remove("hidden");
  bodyMode("ended");
  if (document.pointerLockElement) document.exitPointerLock();
  renderResult(snapshot);
}

function enterEntry() {
  app.role = null;
  app.playerId = null;
  app.code = null;
  app.snapshot = null;
  app.previousSnapshot = null;
  app.body = null;
  app.mode = "entry";
  app.endedShown = false;
  app.closedHandled = false;
  app.host = null;
  app.client = null;
  app.keys.clear();
  app.touchVector.x = 0;
  app.touchVector.z = 0;
  app.jumpQueued = false;
  if (app.world) {
    app.world.setLocalId(null);
    app.world.syncPlayers({ players: [] });
    app.world.setViewState({ switches: { open: false }, checkpoint: false });
  }
  el.room.classList.add("hidden");
  el.hud.classList.add("hidden");
  el.result.classList.add("hidden");
  el.closed.classList.add("hidden");
  el.fatal.classList.add("hidden");
  el.touch.classList.add("hidden");
  document.body.classList.remove("island-in-room", "island-playing", "island-locked");
  setEntryVisible(true);
  updateNetPill(null);
  setEntryBusy(false);
  setEntryError("create", "");
  setEntryError("join", "");
  if (document.pointerLockElement) document.exitPointerLock();
  if (window.location.hash) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function attachSession({ role, host = null, client = null, playerId, code, snapshot }) {
  app.role = role;
  app.host = host;
  app.client = client;
  app.playerId = playerId;
  app.code = code;
  document.body.classList.add("island-in-room");
  updateNetPill(networkLabel(snapshot), false);
  app.world.setLocalId(playerId);
  handleSnapshot(snapshot, true);
}

async function createRoom() {
  const name = readName();
  if (!name) return;
  setEntryError("create", "");
  setEntryError("join", "");
  setEntryBusy(true);
  try {
    const host = await createIslandRoom({
      name,
      onSnapshot: (snapshot) => handleSnapshot(snapshot),
      onEvent: (event) => handleHostEvent(event),
      onError: (message) => {
        showToast(message, "error");
        setNetworkOffline(true);
      },
    });
    app.closedHandled = false;
    attachSession({
      role: "host",
      host,
      playerId: host.playerId,
      code: host.code,
      snapshot: host.snapshot,
    });
    showToast(`Đã mở phòng ${host.code}. Gửi mã cho bạn bè nhé.`, "success", 4200);
  } catch (error) {
    setEntryError("create", error.message || "Không tạo được phòng.");
  } finally {
    setEntryBusy(false);
  }
}

async function joinRoom() {
  const name = readName();
  if (!name) return;
  const code = el.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  el.codeInput.value = code;
  if (code.length !== 5) {
    setEntryError("join", "Mã phòng phải có đủ 5 ký tự.");
    el.codeInput.focus();
    return;
  }
  setEntryError("create", "");
  setEntryError("join", "");
  setEntryBusy(true);
  let joined = false;
  try {
    const client = await joinIslandRoom({
      code,
      name,
      onSnapshot: (snapshot) => handleSnapshot(snapshot),
      onClosed: (message) => handleClosed(message),
      onEvent: (event) => {
        if (event.type === "network") {
          showToast(event.message, "error");
          setNetworkOffline(true);
        }
      },
    });
    joined = true;
    app.closedHandled = false;
    attachSession({
      role: "guest",
      client,
      playerId: client.playerId,
      code: client.code,
      snapshot: client.state,
    });
    showToast(`Đã vào phòng ${client.code}.`, "success");
  } catch (error) {
    if (!joined) setEntryError("join", error.message || "Không vào được phòng.");
  } finally {
    setEntryBusy(false);
  }
}

function setNetworkOffline(offline) {
  el.network.classList.toggle("is-offline", offline);
  if (offline) {
    el.network.textContent = "Mất kết nối · đang thử lại";
    updateNetPill("Mất kết nối", true);
  }
}

function handleSnapshot(snapshot, initial = false) {
  if (!snapshot) return;
  if (app.closedHandled) return;
  const previous = app.previousSnapshot;
  app.previousSnapshot = snapshot;
  app.snapshot = snapshot;
  app.snapshotAt = performance.now();
  if (!(snapshot.players ?? []).some((player) => player.id === app.playerId)) {
    handleClosed("Bạn không còn trong phòng.");
    return;
  }
  app.world.setLocalId(app.playerId);
  app.world.syncPlayers(snapshot);
  app.world.setViewState(snapshot);
  if (app.role === "guest" && previous && !initial) detectGuestChanges(previous, snapshot);
  updateNetPill(networkLabel(snapshot), false);
  if (snapshot.phase === "lobby") {
    if (app.mode !== "room") showRoomScreen(snapshot);
    else renderLobby(snapshot);
  } else if (snapshot.phase === "playing") {
    if (app.mode !== "playing") {
      enterPlaying(snapshot);
    } else {
      updateHud(snapshot);
      correctGuestBody(snapshot);
    }
  } else if (snapshot.phase === "ended") {
    if (app.mode !== "ended") enterEnded(snapshot);
    else renderResult(snapshot);
  }
}

function detectGuestChanges(previous, next) {
  if (!previous.switches?.open && next.switches?.open) {
    announce("Cầu mây đã mở! Cả nhóm cùng qua cầu.", 3400);
    showToast("Hai công tắc đã được giữ đủ lâu. Cầu mây mở.", "success");
  }
  if (!previous.checkpoint && next.checkpoint) {
    announce("Đã chạm mốc lưu. Cả nhóm sẽ hồi sinh tại đây.", 3400);
  }
  const before = new Set((previous.players ?? []).filter((p) => p.atGoal).map((p) => p.id));
  for (const player of next.players ?? []) {
    if (player.atGoal && !before.has(player.id)) showToast(`${player.name} đã tới đích.`, "success");
  }
}

function handleHostEvent(event) {
  if (!event) return;
  if (event.type === "join") {
    showToast(`${event.name} đã lên đảo.`, "success");
  } else if (event.type === "leave") {
    showToast(`${event.name} đã rời đảo.`, "info");
  } else if (event.type === "door") {
    announce("Cầu mây đã mở! Cả nhóm cùng qua cầu.", 3400);
    showToast("Hai công tắc đã được giữ đủ lâu.", "success");
  } else if (event.type === "checkpoint") {
    announce("Đã chạm mốc lưu. Cả nhóm sẽ hồi sinh tại đây.", 3400);
  } else if (event.type === "arrive") {
    showToast(`${event.name} đã tới đích.`, "success");
  } else if (event.type === "respawn") {
    showToast(`${event.name} đã được đưa về mốc lưu.`, "info");
  }
}

function handleClosed(message) {
  if (app.closedHandled || app.mode === "entry") return;
  app.closedHandled = true;
  app.client?.close();
  app.client = null;
  app.body = null;
  app.mode = "closed";
  bodyMode("closed");
  el.hud.classList.add("hidden");
  el.touch.classList.add("hidden");
  el.result.classList.add("hidden");
  el.room.classList.add("hidden");
  el.closedText.textContent = message || "Chủ phòng đã đóng phòng.";
  el.closed.classList.remove("hidden");
  updateNetPill("Đã đóng", true);
  if (document.pointerLockElement) document.exitPointerLock();
}

function renderLobby(snapshot) {
  const players = snapshot.players ?? [];
  const isHost = app.role === "host";
  el.lobbyCode.textContent = app.code || "-----";
  el.lobbyLink.textContent = inviteLink().replace(/^https?:\/\//, "");
  el.lobbyCount.textContent = `${players.length}/4`;
  el.lobbyPlayers.replaceChildren();
  for (const player of players) {
    const li = document.createElement("li");
    li.className = "island-player";
    const avatar = document.createElement("span");
    avatar.className = "island-player__avatar";
    avatar.style.setProperty("--player-color", colorFor(player.color).hex);
    avatar.textContent = initialsOf(player.name);
    const name = document.createElement("span");
    name.className = "island-player__name";
    name.textContent = player.name;
    const tag = document.createElement("span");
    tag.className = "island-player__tag";
    if (player.host) {
      tag.classList.add("island-player__tag--host");
      tag.textContent = "Chủ phòng";
    } else if (player.id === app.playerId) {
      tag.textContent = "Bạn";
    } else {
      tag.textContent = "Sẵn sàng";
    }
    li.append(avatar, name, tag);
    el.lobbyPlayers.appendChild(li);
  }
  if (!players.length) {
    const empty = document.createElement("li");
    empty.className = "island-player__empty";
    empty.textContent = "Chưa có ai trên đảo.";
    el.lobbyPlayers.appendChild(empty);
  }
  const count = players.length;
  const practice = count === 1;
  el.lobbyMode.textContent = practice
    ? "1 người · luyện tập bản đồ"
    : `${count} người · thử thách phối hợp`;
  el.startBtn.classList.toggle("hidden", !isHost);
  el.lobbyWait.classList.toggle("hidden", isHost);
  if (isHost) {
    el.startBtn.textContent = practice ? "Bắt đầu luyện tập" : "Bắt đầu vượt đảo";
    el.lobbyHint.textContent = practice
      ? "Chế độ luyện tập mở sẵn cầu mây. Kết quả không tính là chiến thắng phối hợp."
      : "Hai người cần đứng lên hai công tắc cùng lúc để mở cầu.";
  } else {
    el.lobbyHint.textContent = "Chờ chủ phòng bắt đầu. Phòng nhận tối đa 4 người.";
    el.lobbyWait.textContent = "Đang chờ chủ phòng bắt đầu…";
  }
}

function updateHud(snapshot) {
  if (!snapshot) return;
  const players = snapshot.players ?? [];
  const switches = snapshot.switches ?? { a: [], b: [], charge: 0, open: false };
  const checkpoint = Boolean(snapshot.checkpoint);
  const count = players.length;
  el.leaveGameLabel.textContent = app.role === "host" ? "Đóng phòng" : "Rời phòng";
  el.switchA.classList.toggle("is-on", (switches.a?.length ?? 0) > 0);
  el.switchB.classList.toggle("is-on", (switches.b?.length ?? 0) > 0);
  el.checkpoint.classList.toggle("is-on", checkpoint);
  const charge = switches.open ? 1 : Math.min(1, (switches.charge ?? 0) / SWITCH_SECONDS);
  el.progress.style.width = `${Math.round(charge * 100)}%`;
  if (snapshot.practice) {
    el.hudObjective.textContent = checkpoint
      ? "Luyện tập · bước vào vòng đích"
      : "Luyện tập · chạm mốc lưu phía trước";
  } else if (switches.open && checkpoint) {
    el.hudObjective.textContent = "Cả nhóm cùng bước vào vòng đích";
  } else if (switches.open) {
    el.hudObjective.textContent = "Qua cầu mây, chạm mốc lưu";
  } else {
    el.hudObjective.textContent = "Đứng lên hai công tắc A · B cùng lúc";
  }
  el.hudPlayers.replaceChildren();
  for (const player of players) {
    const chip = document.createElement("span");
    chip.className = "hud-player";
    if (player.atGoal) chip.classList.add("is-arrived");
    chip.style.setProperty("--player-color", colorFor(player.color).hex);
    const dot = document.createElement("span");
    dot.className = "hud-player__dot";
    const name = document.createElement("span");
    name.textContent = player.name;
    chip.append(dot, name);
    el.hudPlayers.appendChild(chip);
  }
  el.network.textContent = `${networkLabel(snapshot)} · ${count === 1 ? "luyện tập" : "đồng đội"}`;
  el.network.classList.remove("is-offline");
  updateTimerDisplay();
}

function updateTimerDisplay() {
  if (!app.snapshot) return;
  let elapsed = app.snapshot.elapsed ?? 0;
  if (app.mode === "playing") {
    elapsed += (performance.now() - app.snapshotAt) / 1000;
  }
  el.hudTimer.textContent = formatTime(elapsed);
}

function renderResult(snapshot) {
  const practice = Boolean(snapshot.practice);
  const players = snapshot.players ?? [];
  el.resultKicker.textContent = practice ? "Luyện tập hoàn tất" : "Thử thách hoàn thành";
  el.resultTitle.textContent = practice ? "Bạn đã chạm đích!" : "Cả nhóm đã về đích!";
  el.resultSub.textContent = practice
    ? "Chế độ một người giúp bạn kiểm tra bản đồ. Kết quả này không tính là chiến thắng phối hợp."
    : `${players.length} người đã cùng giữ nhịp và vượt qua hòn đảo.`;
  el.resultTime.textContent = formatTime(snapshot.elapsed);
  el.resultPlayersCount.textContent = String(players.length);
  el.resultBridge.textContent = snapshot.switches?.open ? "Đã mở" : "Chưa mở";
  el.resultPlayers.replaceChildren();
  for (const player of players) {
    const li = document.createElement("li");
    const dot = document.createElement("i");
    dot.style.setProperty("--player-color", colorFor(player.color).hex);
    const name = document.createElement("span");
    name.textContent = player.name;
    const state = document.createElement("span");
    state.textContent = player.atGoal ? " · tới đích" : " · chưa tới";
    li.append(dot, name, state);
    el.resultPlayers.appendChild(li);
  }
  el.resultActions.replaceChildren();
  if (app.role === "host") {
    const replay = document.createElement("button");
    replay.className = "btn btn--primary";
    replay.type = "button";
    replay.dataset.resultAction = "replay";
    replay.textContent = "Chơi lại";
    const lobby = document.createElement("button");
    lobby.className = "btn btn--secondary";
    lobby.type = "button";
    lobby.dataset.resultAction = "lobby";
    lobby.textContent = "Về sảnh chờ";
    const close = document.createElement("button");
    close.className = "btn btn--ghost btn--danger";
    close.type = "button";
    close.dataset.resultAction = "close";
    close.textContent = "Đóng phòng";
    el.resultActions.append(replay, lobby, close);
    el.resultNote.textContent = `Phòng ${app.code} · chủ phòng có thể chơi lại hoặc mở sảnh chờ.`;
  } else {
    const leave = document.createElement("button");
    leave.className = "btn btn--ghost btn--danger";
    leave.type = "button";
    leave.dataset.resultAction = "close";
    leave.textContent = "Rời phòng";
    el.resultActions.appendChild(leave);
    el.resultNote.textContent = "Đang chờ chủ phòng chơi lại hoặc mở sảnh chờ.";
  }
}

function correctGuestBody(snapshot) {
  if (app.role !== "guest" || !app.body) return;
  const local = localSnapshotPlayer(snapshot);
  if (!local) return;
  const dx = app.body.x - local.x;
  const dy = app.body.y - local.y;
  const dz = app.body.z - local.z;
  if (dx * dx + dy * dy + dz * dz > 9) {
    setBodyPose(local, app.body.yaw);
  }
}

function setBodyPose(point, yaw = app.body?.yaw ?? 0) {
  if (!app.body) return;
  app.body.x = point.x;
  app.body.y = point.y;
  app.body.z = point.z;
  app.body.vx = 0;
  app.body.vy = 0;
  app.body.vz = 0;
  app.body.yaw = yaw;
  app.body.grounded = true;
  app.body.coyote = 0;
  app.body.jumpBuffer = 0;
}

function respawnPointFor(snapshot, id) {
  const players = snapshot?.players ?? [];
  const index = Math.max(0, players.findIndex((player) => player.id === id));
  const points = snapshot?.checkpoint ? CHECKPOINT_SPAWN_POINTS : SPAWN_POINTS;
  return points[index % points.length];
}

function respawnLocal() {
  if (!app.body || !app.snapshot) return;
  if (app.role === "host" && app.host) {
    const spawn = respawnPlayer(app.host.state, app.playerId);
    if (spawn) setBodyPose(spawn, Math.PI);
    app.host.broadcast(true);
    showToast("Bạn đã được đưa về mốc lưu gần nhất.", "info");
  } else if (app.role === "guest" && app.client) {
    const spawn = respawnPointFor(app.snapshot, app.playerId);
    setBodyPose(spawn, Math.PI);
    app.client.sendPose(poseOf(app.body), Date.now());
    showToast("Bạn đã được đưa về mốc lưu gần nhất.", "info");
  }
}

function readInput() {
  let x = 0;
  let z = 0;
  if (app.keys.has("KeyW") || app.keys.has("ArrowUp")) z += 1;
  if (app.keys.has("KeyS") || app.keys.has("ArrowDown")) z -= 1;
  if (app.keys.has("KeyD") || app.keys.has("ArrowRight")) x += 1;
  if (app.keys.has("KeyA") || app.keys.has("ArrowLeft")) x -= 1;
  if (Math.abs(app.touchVector.x) > 0.08 || Math.abs(app.touchVector.z) > 0.08) {
    x = app.touchVector.x;
    z = app.touchVector.z;
  }
  const magnitude = Math.hypot(x, z);
  if (magnitude > 1) {
    x /= magnitude;
    z /= magnitude;
  }
  const forwardX = -Math.sin(app.cameraYaw);
  const forwardZ = -Math.cos(app.cameraYaw);
  const rightX = Math.cos(app.cameraYaw);
  const rightZ = -Math.sin(app.cameraYaw);
  return {
    x: rightX * x + forwardX * z,
    z: rightZ * x + forwardZ * z,
  };
}

function updateGame(dt) {
  if (!app.snapshot || !app.body) return;
  const snapshot = app.snapshot;
  const input = readInput();
  const moving = Math.hypot(input.x, input.z) > 0.08;
  if (moving) {
    app.body.yaw = Math.atan2(input.x, input.z);
  }
  app.accumulator = Math.min(app.accumulator + dt, FIXED_STEP * 8);
  let jump = app.jumpQueued;
  app.jumpQueued = false;
  let steps = 0;
  while (app.accumulator >= FIXED_STEP && steps < 6) {
    const result = stepBody(
      app.body,
      {
        x: input.x,
        z: input.z,
        jump,
        doorOpen: Boolean(snapshot.switches?.open),
      },
      undefined,
      FIXED_STEP
    );
    jump = false;
    if (result.fell) {
      respawnLocal();
    }
    const pose = poseOf(app.body);
    if (app.role === "host" && app.host) {
      app.host.setLocalPose(pose);
      if (app.snapshot?.phase === "playing") app.host.tick(Date.now(), FIXED_STEP);
    } else if (app.role === "guest" && app.client) {
      app.client.sendPose(pose, Date.now());
    }
    app.localSpeed = Math.hypot(app.body.vx, app.body.vz);
    app.accumulator -= FIXED_STEP;
    steps += 1;
  }
  app.world.setLocalPose(app.playerId, poseOf(app.body), app.localSpeed, dt);
  updateCamera(dt);
}

function updateEnded(dt) {
  if (!app.body) return;
  app.world.setLocalPose(app.playerId, poseOf(app.body), 0, dt);
  updateCamera(dt);
}

function updateCamera(dt, snap = false) {
  if (!app.body) return;
  const targetX = app.body.x;
  const targetY = app.body.y + 1.14;
  const targetZ = app.body.z;
  const horizontal = Math.cos(app.cameraPitch) * 7.4;
  const height = 2.15 + Math.sin(app.cameraPitch) * 7.4 * 0.92;
  const desiredX = targetX + Math.sin(app.cameraYaw) * horizontal;
  const desiredY = Math.max(targetY + 0.55, targetY + height);
  const desiredZ = targetZ + Math.cos(app.cameraYaw) * horizontal;
  if (snap || !app.cameraReady) {
    app.camera.position.set(desiredX, desiredY, desiredZ);
    app.cameraReady = true;
  } else {
    const alpha = 1 - Math.exp(-9 * dt);
    app.camera.position.x += (desiredX - app.camera.position.x) * alpha;
    app.camera.position.y += (desiredY - app.camera.position.y) * alpha;
    app.camera.position.z += (desiredZ - app.camera.position.z) * alpha;
  }
  app.camera.lookAt(targetX, targetY, targetZ);
}

function updatePreview(dt) {
  app.previewTime += dt;
  const angle = Math.sin(app.previewTime * 0.09) * 0.42;
  app.camera.position.set(
    Math.sin(angle) * 26,
    10.4 + Math.sin(app.previewTime * 0.18) * 0.8,
    33 + Math.cos(angle) * 5
  );
  app.camera.lookAt(0, 1.2, -18);
  const local = localSnapshotPlayer();
  if (local) app.world.setLocalPose(app.playerId, local, 0, dt);
}

function frame(now) {
  if (app.disposed) return;
  const rawDt = app.lastFrame ? (now - app.lastFrame) / 1000 : 0;
  app.lastFrame = now;
  const dt = Math.min(0.08, Math.max(0, rawDt));
  if (app.mode === "playing") updateGame(dt);
  else if (app.mode === "ended") updateEnded(dt);
  else updatePreview(dt);
  app.world.update(dt);
  if (now - app.lastHudAt > 100) {
    app.lastHudAt = now;
    updateTimerDisplay();
  }
  app.renderer.render(app.world.scene, app.camera);
  requestAnimationFrame(frame);
}

function resize() {
  if (!app.renderer) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  app.renderer.setSize(width, height, false);
  app.camera.aspect = width / Math.max(1, height);
  app.camera.updateProjectionMatrix();
}

function isTouchDevice() {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    (navigator.maxTouchPoints || 0) > 0 ||
    window.innerWidth <= 760
  );
}

function showHelp() {
  if (document.pointerLockElement) document.exitPointerLock();
  if (typeof el.helpDialog.showModal === "function") {
    if (!el.helpDialog.open) el.helpDialog.showModal();
  } else {
    el.helpDialog.setAttribute("open", "");
  }
}

function closeHelp() {
  if (typeof el.helpDialog.close === "function") el.helpDialog.close();
  else el.helpDialog.removeAttribute("open");
}

function askConfirm({ kicker = "Xác nhận", title, text, okLabel = "Rời phòng" }) {
  if (app.confirmResolver) {
    app.confirmResolver(false);
    app.confirmResolver = null;
  }
  el.confirmKicker.textContent = kicker;
  el.confirmTitle.textContent = title;
  el.confirmText.textContent = text;
  el.confirmOk.textContent = okLabel;
  el.confirm.classList.remove("hidden");
  return new Promise((resolve) => {
    app.confirmResolver = resolve;
  });
}

function resolveConfirm(value) {
  if (!app.confirmResolver) return;
  const resolver = app.confirmResolver;
  app.confirmResolver = null;
  el.confirm.classList.add("hidden");
  resolver(value);
}

async function leaveSession() {
  const isHost = app.role === "host";
  const confirmed = await askConfirm({
    kicker: isHost ? "Đóng phòng" : "Rời phòng",
    title: isHost ? "Đóng phòng?" : "Rời khỏi đảo?",
    text: isHost
      ? "Mọi người trong phòng sẽ được đưa về sảnh chọn game. Không thể hoàn tác."
      : "Bạn sẽ rời khỏi đảo. Có thể vào lại bằng mã phòng nếu chủ phòng vẫn mở.",
    okLabel: isHost ? "Đóng phòng" : "Rời phòng",
  });
  if (!confirmed) return;
  if (isHost) {
    app.host?.close("Chủ phòng đã đóng phòng.");
    enterEntry();
  } else {
    app.client?.close();
    enterEntry();
  }
}

function leaveSessionToHome(run) {
  if (run) {
    if (document.pointerLockElement) document.exitPointerLock();
    window.location.href = "index.html";
  }
}

function bindUI() {
  el.createBtn.addEventListener("click", createRoom);
  el.joinBtn.addEventListener("click", joinRoom);
  el.nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (el.codeInput.value.trim()) joinRoom();
      else createRoom();
    }
  });
  el.codeInput.addEventListener("input", () => {
    el.codeInput.value = el.codeInput.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 5);
  });
  el.codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      joinRoom();
    }
  });
  el.helpBtn.addEventListener("click", showHelp);
  el.hudHelpBtn.addEventListener("click", showHelp);
  el.closeHelpBtn.addEventListener("click", closeHelp);
  el.okHelpBtn.addEventListener("click", closeHelp);
  el.helpDialog.addEventListener("click", (event) => {
    if (event.target === el.helpDialog) closeHelp();
  });
  el.lobbyCodeBtn.addEventListener("click", () => copyText(app.code, `Đã sao chép mã ${app.code}.`));
  el.copyLinkBtn.addEventListener("click", () => copyText(inviteLink(), "Đã sao chép link mời."));
  el.startBtn.addEventListener("click", () => {
    if (app.role !== "host" || !app.host) return;
    const result = app.host.start(Date.now());
    if (!result.ok) showToast(result.reason || "Không bắt đầu được ván.", "error");
  });
  el.leaveLobbyBtn.addEventListener("click", leaveSession);
  el.leaveGameBtn.addEventListener("click", leaveSession);
  el.closedHomeBtn.addEventListener("click", enterEntry);
  el.fatalReloadBtn.addEventListener("click", () => location.reload());
  el.resultActions.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-result-action]")?.dataset.resultAction;
    if (!action) return;
    if (action === "replay") {
      if (app.role !== "host" || !app.host) return;
      const result = app.host.start(Date.now());
      if (!result.ok) showToast(result.reason || "Không bắt đầu lại được.", "error");
    } else if (action === "lobby") {
      if (app.role !== "host" || !app.host) return;
      app.host.toLobby();
    } else if (action === "close") {
      await leaveSession();
    }
  });
  el.confirmCancel.addEventListener("click", () => resolveConfirm(false));
  el.confirmOk.addEventListener("click", () => resolveConfirm(true));
  el.confirm.addEventListener("click", (event) => {
    if (event.target === el.confirm) resolveConfirm(false);
  });
  el.jumpBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    app.jumpQueued = true;
  });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", clearInputs);
  window.addEventListener("resize", resize);
  window.addEventListener("pagehide", cleanup);
  window.addEventListener("beforeunload", (event) => {
    if (!app.host && !app.client) return;
    event.preventDefault();
    event.returnValue = "";
  });
  document.addEventListener("pointerlockchange", () => {
    app.pointerLocked = document.pointerLockElement === app.renderer?.domElement;
  });
  document.addEventListener("mousemove", onMouseLook);
  app.renderer.domElement.addEventListener("click", () => {
    if (app.mode !== "playing" || app.touchUi || app.pointerLocked) return;
    if (app.renderer.domElement.requestPointerLock) {
      app.renderer.domElement.requestPointerLock();
    }
  });
  app.renderer.domElement.addEventListener("pointerdown", onCanvasPointerDown);
  app.renderer.domElement.addEventListener("pointermove", onCanvasPointerMove);
  app.renderer.domElement.addEventListener("pointerup", onCanvasPointerUp);
  app.renderer.domElement.addEventListener("pointercancel", onCanvasPointerUp);
  bindJoystick();
}

function bindJoystick() {
  let joystickRect = null;
  let pointerId = null;
  const reset = () => {
    pointerId = null;
    el.joystickStick.style.transform = "translate(-50%, -50%)";
    app.touchVector.x = 0;
    app.touchVector.z = 0;
  };
  const update = (event) => {
    if (pointerId !== event.pointerId || !joystickRect) return;
    const dx = event.clientX - joystickRect.left - joystickRect.width / 2;
    const dy = event.clientY - joystickRect.top - joystickRect.height / 2;
    const max = joystickRect.width * 0.32;
    const distance = Math.hypot(dx, dy);
    const scale = distance > max ? max / distance : 1;
    const x = dx * scale;
    const y = dy * scale;
    el.joystickStick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    app.touchVector.x = x / max;
    app.touchVector.z = -y / max;
  };
  el.joystick.addEventListener("pointerdown", (event) => {
    if (app.mode !== "playing") return;
    event.preventDefault();
    joystickRect = el.joystick.getBoundingClientRect();
    pointerId = event.pointerId;
    el.joystick.setPointerCapture(event.pointerId);
    update(event);
  });
  el.joystick.addEventListener("pointermove", (event) => {
    if (pointerId === event.pointerId) {
      event.preventDefault();
      update(event);
    }
  });
  el.joystick.addEventListener("pointerup", reset);
  el.joystick.addEventListener("pointercancel", reset);
}

function onKeyDown(event) {
  if (app.mode !== "playing" || isTextInput(event.target) || el.helpDialog.open) return;
  const blocked = [
    "KeyW",
    "KeyA",
    "KeyS",
    "KeyD",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ];
  if (blocked.includes(event.code)) event.preventDefault();
  if (event.code === "Space" && !event.repeat) app.jumpQueued = true;
  app.keys.add(event.code);
}

function onKeyUp(event) {
  app.keys.delete(event.code);
}

function clearInputs() {
  app.keys.clear();
  app.touchVector.x = 0;
  app.touchVector.z = 0;
  app.jumpQueued = false;
}

function onMouseLook(event) {
  if (app.mode !== "playing" || !app.pointerLocked) return;
  app.cameraYaw -= event.movementX * 0.0026;
  app.cameraPitch = Math.max(-0.16, Math.min(0.78, app.cameraPitch + event.movementY * 0.0024));
}

function onCanvasPointerDown(event) {
  if (app.mode !== "playing" || app.pointerLocked) return;
  app.dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
  app.renderer.domElement.setPointerCapture(event.pointerId);
}

function onCanvasPointerMove(event) {
  if (!app.dragging || app.dragging.id !== event.pointerId) return;
  const dx = event.clientX - app.dragging.x;
  const dy = event.clientY - app.dragging.y;
  app.dragging.x = event.clientX;
  app.dragging.y = event.clientY;
  app.cameraYaw -= dx * 0.0042;
  app.cameraPitch = Math.max(-0.16, Math.min(0.78, app.cameraPitch + dy * 0.0034));
}

function onCanvasPointerUp(event) {
  if (app.dragging?.id === event.pointerId) app.dragging = null;
}

function showFatal(message) {
  el.fatalText.textContent = message;
  el.fatalText.hidden = false;
  el.fatal.classList.remove("hidden");
  el.loading.classList.add("is-done");
}

function cleanup() {
  if (app.disposed) return;
  app.disposed = true;
  if (app.host) app.host.close();
  if (app.client) app.client.close();
  app.world?.dispose();
  app.renderer?.dispose();
}

function parseInviteHash() {
  const match = window.location.hash.match(/^#(?:\/p\/|p=)([A-Za-z0-9]{5})$/);
  if (!match) return;
  el.codeInput.value = match[1].toUpperCase();
  setTimeout(() => {
    showToast(`Mã phòng ${match[1].toUpperCase()} đã được điền. Nhập tên rồi bấm Vào.`, "info", 5000);
  }, 300);
}

export function startIsland() {
  if (app.renderer) return;
  app.touchUi = isTouchDevice();
  el.nameInput.value = loadName();
  parseInviteHash();
  try {
    app.renderer = createRenderer(el.scene);
    app.renderer.domElement.tabIndex = 0;
    app.world = new IslandWorld();
    app.camera = createCamera();
    resize();
    bindUI();
    requestAnimationFrame(frame);
    if (new URLSearchParams(window.location.search).has("debug")) {
      window.__islandDebug = {
        get app() {
          return app;
        },
        get snapshot() {
          return app.snapshot;
        },
        get body() {
          return app.body;
        },
        teleport(id, x, y, z) {
          if (!app.host || !app.host.state.players[id]) return false;
          Object.assign(app.host.state.players[id], { x, y, z, grounded: true });
          app.host.broadcast(true);
          if (id === app.playerId) setBodyPose({ x, y, z }, Math.PI);
          return true;
        },
        teleportLocal(x, y, z) {
          if (!app.body) return false;
          setBodyPose({ x, y, z }, app.body.yaw);
          if (app.host) {
            app.host.setLocalPose(poseOf(app.body));
            app.host.broadcast(true);
          } else if (app.client) {
            app.client.sendPose(poseOf(app.body), Date.now());
          }
          return true;
        },
      };
    }
  } catch (error) {
    console.error("Island failed to start:", error);
    showFatal(
      "Không thể khởi tạo cảnh 3D. Hãy bật WebGL hoặc dùng Chrome, Edge, Firefox mới hơn."
    );
  }
}
