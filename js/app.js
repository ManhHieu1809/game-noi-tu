import {
  GameHost,
  MAX_PLAYERS,
  TITLE_RULES,
  TURN_SECONDS,
  initialsOf,
  hueOf,
  sanitizeName,
} from "./game-core.js";
import { loadDictionary } from "./dictionary.js";
import { LobbyDirectory } from "./lobby-directory.js";
import { cleanCode, CODE_LENGTH, createRoomPeer, connectToRoom } from "./net.js";

const LS_NAME = "noitu.name";
const LS_RECENT = "noitu.recent";
const TITLE_MAP = new Map(TITLE_RULES.map((title) => [title.id, title]));

const $ = (id) => document.getElementById(id);

const els = {
  brandHome: $("brandHome"),
  nameInput: $("nameInput"),
  createBtn: $("createBtn"),
  joinBtn: $("joinBtn"),
  codeInput: $("codeInput"),
  homeError: $("homeError"),
  createError: $("createError"),
  recentWrap: $("recentWrap"),
  recentList: $("recentList"),
  screenHome: $("screenHome"),
  screenRoom: $("screenRoom"),
  netPill: $("netPill"),
  netPillText: $("netPillText"),
  roomCodeText: $("roomCodeText"),
  roomCodeBtn: $("roomCodeBtn"),
  inviteBtn: $("inviteBtn"),
  roomModePill: $("roomModePill"),
  leaveBtn: $("leaveBtn"),
  playerCount: $("playerCount"),
  playersList: $("playersList"),
  hostSettings: $("hostSettings"),
  gameModeSelect: $("gameModeSelect"),
  pairModeField: $("pairModeField"),
  pairModeSelect: $("pairModeSelect"),
  modeSelect: $("modeSelect"),
  lobbyActions: $("lobbyActions"),
  startBtn: $("startBtn"),
  startHint: $("startHint"),
  gameActions: $("gameActions"),
  endBtn: $("endBtn"),
  stageLobby: $("stageLobby"),
  lobbyTitle: $("lobbyTitle"),
  lobbySub: $("lobbySub"),
  lobbyCode: $("lobbyCode"),
  lobbyInviteBtn: $("lobbyInviteBtn"),
  lobbyChain: $("lobbyChain"),
  lobbyWait: $("lobbyWait"),
  stageGame: $("stageGame"),
  turnBadge: $("turnBadge"),
  turnSub: $("turnSub"),
  timer: $("timer"),
  timerRing: $("timerRing"),
  timerText: $("timerText"),
  timerUnit: $("timerUnit"),
  targetCard: $("targetCard"),
  targetLabel: $("targetLabel"),
  targetSyllable: $("targetSyllable"),
  targetHint: $("targetHint"),
  answerForm: $("answerForm"),
  answerInput: $("answerInput"),
  answerBtn: $("answerBtn"),
  answerError: $("answerError"),
  pairControl: $("pairControl"),
  pairControlValue: $("pairControlValue"),
  pairForm: $("pairForm"),
  pairInput1: $("pairInput1"),
  pairInput2: $("pairInput2"),
  pairError: $("pairError"),
  randomPairBtn: $("randomPairBtn"),
  chainMini: $("chainMini"),
  waitingTurn: $("waitingTurn"),
  waitingTurnText: $("waitingTurnText"),
  stageEnded: $("stageEnded"),
  winnerTitle: $("winnerTitle"),
  winnerSub: $("winnerSub"),
  winnerTitles: $("winnerTitles"),
  podium: $("podium"),
  titleBoard: $("titleBoard"),
  titleCount: $("titleCount"),
  titleBoardGrid: $("titleBoardGrid"),
  endActions: $("endActions"),
  historyList: $("historyList"),
  historyEmpty: $("historyEmpty"),
  usedCount: $("usedCount"),
  toasts: $("toasts"),
  overlay: $("overlay"),
  overlayCard: $("overlayCard"),
  lobbyLive: $("lobbyLive"),
  lobbyLiveText: $("lobbyLiveText"),
  roomList: $("roomList"),
  lobbyNote: $("lobbyNote"),
  howToBtn: $("howToBtn"),
  roomRulesBtn: $("roomRulesBtn"),
  rulesDialog: $("rulesDialog"),
  closeRulesBtn: $("closeRulesBtn"),
  okRulesBtn: $("okRulesBtn"),
  titleRules: $("titleRules"),
};

const app = {
  dictionary: null,
  role: null,
  playerId: null,
  roomCode: null,
  peer: null,
  conn: null,
  conns: new Map(),
  game: null,
  state: null,
  deadline: 0,
  lastEventId: 0,
  lastHistoryN: 0,
  answerPending: false,
  answerTimeout: null,
  pairFormKey: "",
  presenceTimer: null,
  directory: null,
  rooms: [],
  lastToast: null,
};

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ESC_MAP[ch]);

const pairText = (pair) =>
  Array.isArray(pair) && pair.length === 2
    ? pair.map((letter) => String(letter).toLocaleUpperCase("vi")).join(" · ")
    : "…";

function loadSavedName() {
  try {
    return localStorage.getItem(LS_NAME) || "";
  } catch {
    return "";
  }
}

function saveName(name) {
  try {
    localStorage.setItem(LS_NAME, name);
  } catch {
    /* ignore */
  }
}

function getRecentRooms() {
  try {
    const list = JSON.parse(localStorage.getItem(LS_RECENT) || "[]");
    return Array.isArray(list) ? list.filter((item) => item && typeof item.code === "string") : [];
  } catch {
    return [];
  }
}

function addRecentRoom(code) {
  const list = getRecentRooms().filter((item) => item.code !== code);
  list.unshift({ code, at: Date.now() });
  try {
    localStorage.setItem(LS_RECENT, JSON.stringify(list.slice(0, 5)));
  } catch {
    /* ignore */
  }
  renderRecentRooms();
}

function renderRecentRooms() {
  const list = getRecentRooms();
  els.recentWrap.hidden = list.length === 0;
  els.recentList.innerHTML = list
    .map((item) => `<button class="recent-chip" type="button" data-code="${esc(item.code)}">${esc(item.code)}</button>`)
    .join("");
}

function readName(showError = true) {
  const name = sanitizeName(els.nameInput.value, "");
  if (!name) {
    if (showError) {
      showHomeError("Hãy nhập tên của bạn trước đã.");
      els.nameInput.focus();
    }
    return null;
  }
  els.nameInput.value = name;
  saveName(name);
  return name;
}

function showHomeError(message) {
  els.homeError.textContent = message || "";
}

function showCreateError(message) {
  els.createError.textContent = message || "";
}

function setBusy(button, busy) {
  if (button) button.disabled = Boolean(busy);
}

function showToast(message, type = "info", duration = 3600) {
  const now = Date.now();
  const key = `${type}:${message}`;
  if (app.lastToast?.key === key && now - app.lastToast.at < 1800) return;
  app.lastToast = { key, at: now };

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  const icon = type === "success" ? "✓" : type === "error" ? "!" : "i";
  toast.innerHTML = `<span class="toast__icon" aria-hidden="true">${icon}</span><span>${esc(message)}</span>`;
  els.toasts.appendChild(toast);

  while (els.toasts.children.length > 3) {
    const oldest = els.toasts.firstElementChild;
    if (!oldest) break;
    oldest.remove();
  }

  setTimeout(() => {
    toast.classList.add("is-out");
    setTimeout(() => toast.remove(), 260);
  }, duration);
}

async function copyText(text, successMessage) {
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
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand("copy");
      textarea.remove();
    } catch {
      copied = false;
    }
  }

  if (copied) showToast(successMessage, "success");
  else showToast("Không sao chép được. Hãy chọn và sao chép thủ công.", "error");
}

function inviteLink() {
  if (!app.roomCode) return "";
  const base = window.location.href.split("#")[0];
  return `${base}#/p/${app.roomCode}`;
}

function copyInvite() {
  if (!app.roomCode) return;
  copyText(inviteLink(), `Đã sao chép link mời phòng ${app.roomCode}.`);
}

function setOverlayDismissible(dismissible) {
  els.overlay.dataset.dismissible = dismissible ? "1" : "0";
}

function showLoading(title, text) {
  setOverlayDismissible(false);
  els.overlayCard.innerHTML = `
    <div class="overlay__card--center">
      <div class="spinner" aria-hidden="true"></div>
      <h2 class="overlay__title">${esc(title)}</h2>
      <p class="overlay__text" id="overlayText">${esc(text)}</p>
    </div>`;
  els.overlay.classList.remove("hidden");
}

function updateLoadingText(text) {
  const node = $("overlayText");
  if (node) node.textContent = text;
}

function showConfirm({ title, text, confirmLabel, cancelLabel = "Ở lại", danger = false, onConfirm }) {
  setOverlayDismissible(true);
  els.overlayCard.innerHTML = `
    <h2 class="overlay__title">${esc(title)}</h2>
    <p class="overlay__text">${esc(text)}</p>
    <div class="overlay__actions">
      <button class="btn btn--ghost" type="button" id="overlayCancelBtn">${esc(cancelLabel)}</button>
      <button class="btn ${danger ? "btn--danger" : "btn--primary"}" type="button" id="overlayConfirmBtn">${esc(confirmLabel)}</button>
    </div>`;
  els.overlay.classList.remove("hidden");

  $("overlayCancelBtn").addEventListener("click", hideOverlay);
  $("overlayConfirmBtn").addEventListener("click", () => {
    hideOverlay();
    onConfirm?.();
  });
}

function hideOverlay() {
  els.overlay.classList.add("hidden");
  els.overlayCard.innerHTML = "";
  setOverlayDismissible(false);
}

function showFatalOverlay(title, text) {
  setOverlayDismissible(false);
  els.overlayCard.innerHTML = `
    <div class="overlay__card--center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:42px;height:42px;margin:0 auto 12px;color:var(--danger)" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.22"></path>
        <path d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07l1.41-1.41"></path>
        <path d="m3 3 18 18"></path>
      </svg>
      <h2 class="overlay__title">${esc(title)}</h2>
      <p class="overlay__text">${esc(text)}</p>
      <div class="overlay__actions">
        <button class="btn btn--primary" type="button" id="fatalHomeBtn">Về trang chủ</button>
      </div>
    </div>`;
  els.overlay.classList.remove("hidden");
  $("fatalHomeBtn").addEventListener("click", () => {
    hideOverlay();
    resetRoomState();
    exitToHome();
  });
}

function enterRoom() {
  document.body.classList.remove("is-home");
  document.body.classList.add("in-room");
  els.screenHome.classList.add("hidden");
  els.screenRoom.classList.remove("hidden");
  els.netPill.hidden = false;
  els.netPillText.textContent = "P2P";
  app.lastEventId = app.state?.lastEvent?.id || 0;
  app.lastHistoryN = app.state?.history?.length ? app.state.history[app.state.history.length - 1].n : 0;
  renderRoom();
  updateTimer();
  window.history.replaceState(null, "", `#/p/${app.roomCode}`);
  window.scrollTo({ top: 0, behavior: "auto" });
  if (
    app.state?.phase === "playing" &&
    app.state.turnPlayerId === app.playerId &&
    !app.state.awaitingPair
  ) {
    setTimeout(() => els.answerInput.focus(), 120);
  }
}

function exitToHome() {
  document.body.classList.remove("in-room");
  document.body.classList.add("is-home");
  els.screenRoom.classList.add("hidden");
  els.screenHome.classList.remove("hidden");
  els.netPill.hidden = true;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  renderRecentRooms();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function resetRoomState() {
  clearTimeout(app.answerTimeout);
  app.answerTimeout = null;
  app.answerPending = false;
  stopPresence();
  try {
    app.game?.destroy();
  } catch {
    /* ignore */
  }
  try {
    app.conn?.close();
  } catch {
    /* ignore */
  }
  try {
    app.peer?.destroy();
  } catch {
    /* ignore */
  }
  app.game = null;
  app.conn = null;
  app.peer = null;
  app.conns.clear();
  app.role = null;
  app.playerId = null;
  app.roomCode = null;
  app.state = null;
  app.deadline = 0;
  app.lastEventId = 0;
  app.lastHistoryN = 0;
  app.pairFormKey = "";
  clearAnswerError();
  els.answerInput.value = "";
  els.answerInput.disabled = true;
  els.answerBtn.disabled = true;
  els.pairControl.hidden = true;
  els.pairError.textContent = "";
  els.pairInput1.value = "";
  els.pairInput2.value = "";
  els.usedCount.textContent = "0 từ";
  renderRecentRooms();
}

async function createRoom() {
  const name = readName();
  if (!name) return;

  showCreateError("");
  showHomeError("");
  setBusy(els.createBtn, true);
  showLoading("Đang tạo phòng…", "Đang nạp từ điển tiếng Việt…");

  try {
    app.dictionary = await loadDictionary();
    updateLoadingText("Đang kết nối tới máy chủ ghép phòng…");
    const { code, peer } = await createRoomPeer();
    createHostSession(code, peer, name);
    addRecentRoom(code);
    hideOverlay();
    showToast(`Đã tạo phòng ${code}. Chọn kiểu chơi rồi gửi link mời nhé!`, "success", 4200);
  } catch (error) {
    hideOverlay();
    showCreateError(error.message || "Không tạo được phòng. Thử lại nhé.");
  } finally {
    setBusy(els.createBtn, false);
  }
}

function createHostSession(code, peer, name) {
  app.role = "host";
  app.roomCode = code;
  app.peer = peer;
  app.conns.clear();
  app.game = new GameHost({
    code,
    hostName: name,
    hostPeerId: peer.id,
    dictionary: app.dictionary,
    mode: "smart",
    onChange: handleHostGameChange,
  });
  app.playerId = app.game.hostPlayerId;
  app.state = app.game.publicState();
  app.deadline = performance.now() + (app.state.remainingMs || 0);

  peer.on("connection", handleHostConnection);
  peer.on("error", handleHostPeerError);

  enterRoom();
  startPresence();
}

function handleHostGameChange() {
  if (app.role !== "host" || !app.game) return;
  const previous = app.state;
  const state = app.game.publicState();
  consumeState(state, previous);
  broadcastState(state);
  publishPresence();
}

function broadcastState(state) {
  for (const conn of app.conns.values()) {
    if (conn?.open) {
      try {
        conn.send({ t: "state", state });
      } catch {
        /* ignore */
      }
    }
  }
}

function handleHostConnection(conn) {
  let greeted = false;
  const helloTimeout = setTimeout(() => {
    if (!greeted) {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
  }, 12000);

  conn.on("data", (message) => {
    if (!message || typeof message !== "object" || app.role !== "host" || !app.game) return;

    if (message.t === "hello") {
      if (greeted) return;
      greeted = true;
      clearTimeout(helloTimeout);

      try {
        const player = app.game.addPlayer({ name: message.name, peerId: conn.peer, isHost: false });
        conn.playerId = player.id;
        app.conns.set(player.id, conn);
        conn.send({ t: "welcome", playerId: player.id, state: app.game.publicState() });
      } catch (error) {
        try {
          conn.send({ t: "rejected", reason: error.message || "Không thể vào phòng." });
        } catch {
          /* ignore */
        }
        setTimeout(() => conn.close(), 400);
      }
      return;
    }

    if (message.t === "answer") {
      if (!conn.playerId) return;
      const result = app.game.submit(conn.playerId, message.text);
      if (conn.open) {
        try {
          conn.send({
            t: "answerResult",
            ok: result.ok,
            reason: result.reason,
            normalized: result.normalized,
          });
        } catch {
          /* ignore */
        }
      }
      return;
    }

    if (message.t === "leave") {
      if (conn.playerId) {
        app.conns.delete(conn.playerId);
        app.game.removePlayer(conn.playerId);
      }
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
  });

  conn.on("close", () => {
    clearTimeout(helloTimeout);
    if (app.role !== "host" || !app.game) return;
    if (conn.playerId && app.conns.get(conn.playerId) === conn) {
      app.conns.delete(conn.playerId);
      app.game.removePlayer(conn.playerId);
    }
  });

  conn.on("error", () => {
    /* the close event handles cleanup */
  });
}

function handleHostPeerError(error) {
  if (app.role !== "host") return;
  if (error?.type === "browser-incompatible") {
    showToast("Trình duyệt không hỗ trợ WebRTC nên không thể chơi nhiều người.", "error", 6000);
  } else if (["network", "server-error", "socket-error", "socket-closed"].includes(error?.type)) {
    showToast("Máy chủ ghép phòng đang gặp sự cố. Các kết nối đã thiết lập vẫn có thể chơi tiếp.", "info", 5000);
  }
}

async function joinRoom(inputCode) {
  if (app.role) return;
  const name = readName();
  if (!name) return;

  const code = cleanCode(inputCode ?? els.codeInput.value);
  els.codeInput.value = code;
  if (code.length !== CODE_LENGTH) {
    showHomeError(`Mã phòng phải có đúng ${CODE_LENGTH} ký tự.`);
    els.codeInput.focus();
    return;
  }

  showHomeError("");
  setBusy(els.joinBtn, true);
  showLoading("Đang vào phòng…", `Đang tìm phòng ${code}…`);

  try {
    const session = await connectToRoom(code, name);
    app.role = "guest";
    app.roomCode = code;
    app.peer = session.peer;
    app.conn = session.conn;
    app.playerId = session.playerId;
    app.state = session.state;
    app.deadline = performance.now() + (session.state?.remainingMs || 0);
    attachGuestSession();
    addRecentRoom(code);
    hideOverlay();
    enterRoom();
    showToast(`Đã vào phòng ${code}.`, "success");
  } catch (error) {
    hideOverlay();
    showHomeError(error.message || "Không vào được phòng. Kiểm tra lại mã nhé.");
  } finally {
    setBusy(els.joinBtn, false);
  }
}

function attachGuestSession() {
  const conn = app.conn;
  if (!conn) return;

  conn.on("data", (message) => {
    if (!message || typeof message !== "object" || app.role !== "guest") return;

    if (message.t === "state") {
      consumeState(message.state, app.state);
    } else if (message.t === "answerResult") {
      handleAnswerResult(message);
    } else if (message.t === "closed") {
      showRoomClosed(
        "Chủ phòng đã đóng phòng.",
        "Ván chơi đã kết thúc. Hãy tạo phòng mới hoặc vào một phòng khác nhé."
      );
    }
  });

  conn.on("close", () => {
    if (app.role !== "guest") return;
    showRoomClosed(
      "Mất kết nối với chủ phòng.",
      "Kết nối ngang hàng đã bị ngắt. Có thể chủ phòng đã rời đi hoặc mạng gặp sự cố."
    );
  });

  conn.on("error", () => {
    /* the close event handles cleanup */
  });

  app.peer?.on("error", (error) => {
    if (app.role !== "guest") return;
    if (error?.type === "network") {
      showToast("Máy chủ ghép phòng gặp sự cố, nhưng ván đấu có thể vẫn tiếp tục.", "info", 5000);
    }
  });
}

function showRoomClosed(title, text) {
  if (app.role !== "guest") return;
  app.role = null;
  clearTimeout(app.answerTimeout);
  app.answerPending = false;
  try {
    app.peer?.destroy();
  } catch {
    /* ignore */
  }
  app.conn = null;
  app.peer = null;
  showFatalOverlay(title, text);
}

function consumeState(state, previous) {
  if (!state) return;
  app.state = state;
  app.deadline = performance.now() + (state.remainingMs || 0);

  const turnChanged = previous?.turnSeq !== state.turnSeq;
  const pairChanged =
    previous?.awaitingPair !== state.awaitingPair ||
    (previous?.pair || []).join("|") !== (state.pair || []).join("|");

  if (state.lastEvent && state.lastEvent.id !== app.lastEventId) {
    app.lastEventId = state.lastEvent.id;
    showToast(state.lastEvent.message, state.lastEvent.type === "timeout" ? "error" : "info");
  }

  if (state.phase !== "playing" || turnChanged) {
    resetAnswerPending();
    els.answerInput.value = "";
    clearAnswerError();
  }

  renderRoom();
  updateTimer();

  const myTurn = state.phase === "playing" && state.turnPlayerId === app.playerId;
  const pairReady = state.gameMode === "letters" && Boolean(state.pair) && !state.awaitingPair;
  if (myTurn && (turnChanged || (pairReady && pairChanged))) {
    if (state.gameMode === "letters" && state.awaitingPair) {
      showToast("Lượt của bạn! Đang chờ chủ phòng chọn cặp chữ cái.", "info", 3200);
    } else if (pairReady) {
      showToast(
        `Lượt của bạn! Cặp chữ ${pairText(state.pair)}. Nhập đúng 2 âm tiết.`,
        "success",
        3600
      );
      setTimeout(() => els.answerInput.focus(), 80);
    } else {
      const suffix = state.requiredSyllable ? ` Nối từ bắt đầu bằng “${state.requiredSyllable}”.` : "";
      showToast(`Lượt của bạn!${suffix}`, "success", 3200);
      setTimeout(() => els.answerInput.focus(), 80);
    }
  }
}

function renderRoom() {
  const state = app.state;
  if (!state) return;

  els.roomCodeText.textContent = state.code;
  els.lobbyCode.textContent = state.code;
  const modeLabel = state.gameMode === "letters" ? "Đôi chữ cái" : "Nối từ";
  const checkLabel = state.mode === "strict" ? "Khắt khe" : "Thông minh";
  els.roomModePill.textContent = `${modeLabel} · ${checkLabel}`;
  els.roomModePill.title = `${modeLabel}, kiểm tra ${checkLabel.toLowerCase()}`;
  els.gameModeSelect.value = state.gameMode || "chain";
  els.pairModeSelect.value = state.pairMode || "random";
  els.modeSelect.value = state.mode;
  els.playerCount.textContent = `${state.players.length}/${MAX_PLAYERS}`;

  renderPlayers(state);
  renderLobbyActions(state);
  renderStage(state);
  renderHistory(state);
  updateAnswerForm(state);
}

function renderPlayers(state) {
  els.playersList.innerHTML = state.players
    .map((player, index) => {
      const isCurrent = state.phase === "playing" && state.turnPlayerId === player.id;
      const sub = !player.online
        ? "Mất kết nối"
        : isCurrent
          ? state.gameMode === "letters"
            ? state.awaitingPair
              ? "Chờ cặp chữ cái"
              : "Đang trả lời"
            : "Đang nối từ"
          : player.isHost
            ? "Chủ phòng"
            : "Trong phòng";
      const showScore = state.phase !== "lobby";
      const classes = ["player", isCurrent ? "is-current" : "", player.online ? "" : "is-offline"]
        .filter(Boolean)
        .join(" ");

      return `
        <li class="${classes}">
          <span class="player__seat" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <span class="avatar" style="--h:${hueOf(player.id)}" aria-hidden="true">${esc(initialsOf(player.name))}</span>
          <span class="player__body">
            <span class="player__name" title="${esc(player.name)}">
              ${esc(player.name)}
              ${player.isHost ? '<span class="crown">chủ</span>' : ""}
            </span>
            <span class="player__sub ${isCurrent ? "is-turn" : ""}">${esc(sub)}</span>
          </span>
          ${showScore ? `<span class="player__score" title="Điểm">${player.score}</span>` : ""}
        </li>`;
    })
    .join("");
}

function renderLobbyActions(state) {
  const host = app.role === "host";
  const online = state.players.filter((player) => player.online).length;

  els.hostSettings.hidden = !(host && state.phase === "lobby");
  els.lobbyActions.hidden = !(host && state.phase === "lobby");
  els.gameActions.hidden = !(host && state.phase === "playing");
  els.pairModeField.hidden = state.gameMode !== "letters";

  if (host && state.phase === "lobby") {
    const enough = online >= 2;
    els.startBtn.disabled = !enough;
    els.startHint.textContent = enough
      ? `Sẵn sàng với ${online} người chơi.`
      : "Cần ít nhất 2 người để bắt đầu.";
  }
}

function renderStage(state) {
  const phase = state.phase;
  els.stageLobby.classList.toggle("hidden", phase !== "lobby");
  els.stageGame.classList.toggle("hidden", phase !== "playing");
  els.stageEnded.classList.toggle("hidden", phase !== "ended");

  if (phase === "lobby") renderStageLobby(state);
  else if (phase === "playing") renderStageGame(state);
  else renderStageEnded(state);
}

function renderStageLobby(state) {
  const letters = state.gameMode === "letters";
  const online = state.players.filter((player) => player.online).length;

  els.lobbyTitle.textContent = letters ? "Sẵn sàng thử thách đôi chữ?" : "Sẵn sàng nối từ?";
  els.lobbySub.textContent = letters
    ? "Chủ phòng chọn một cặp chữ cho cả ván và cũng trả lời như mọi người. Nhập đúng hai âm tiết bắt đầu tương ứng."
    : "Gửi link mời để bạn bè vào nhanh. Khi đủ ít nhất 2 người, chủ phòng bấm bắt đầu.";

  els.lobbyChain.innerHTML = letters
    ? "<span>H · H</span><i>→</i><span>hoa hồng</span><i>→</i><span>hoàng hôn</span>"
    : "<span>bánh mì</span><i>→</i><span>mì gói</span><i>→</i><span>gói quà</span>";

  if (app.role === "host") {
    const missing = Math.max(0, 2 - online);
    els.lobbyWait.textContent = missing
      ? `Cần thêm ${missing} người để bắt đầu.`
      : "Đã đủ người. Bấm “Bắt đầu chơi” để mở màn.";
  } else {
    els.lobbyWait.textContent = "Đang chờ chủ phòng bắt đầu…";
  }
}

function renderStageGame(state) {
  const letters = state.gameMode === "letters";
  const awaitingPair = letters && Boolean(state.awaitingPair);
  const myTurn = state.turnPlayerId === app.playerId;
  const current = state.players.find((player) => player.id === state.turnPlayerId);
  const currentName = current?.name || "người chơi";

  els.turnBadge.textContent = myTurn ? "Lượt của bạn" : `Lượt của ${currentName}`;
  els.turnBadge.classList.toggle("is-me", myTurn);
  els.turnSub.textContent = awaitingPair
    ? "Đang chờ chủ phòng chọn cặp chữ…"
    : myTurn
      ? letters
        ? "Nhập đúng 2 âm tiết theo cặp chữ."
        : "Nối từ thật nhanh, đừng để hết giờ."
      : "Đang chờ lượt của bạn…";

  if (letters) {
    els.targetLabel.textContent = "Cặp chữ cái";
    if (awaitingPair) {
      els.targetSyllable.textContent = "… · …";
      els.targetSyllable.classList.add("is-open");
      els.targetCard.classList.add("is-open");
      els.targetHint.textContent = "Chủ phòng chưa chọn cặp chữ cho ván này.";
    } else {
      els.targetSyllable.textContent = pairText(state.pair);
      els.targetSyllable.classList.remove("is-open");
      els.targetCard.classList.remove("is-open");
      const first = String(state.pair?.[0] || "").toLocaleUpperCase("vi");
      const second = String(state.pair?.[1] || "").toLocaleUpperCase("vi");
      els.targetHint.textContent = `Nhập đúng 2 âm tiết: âm tiết 1 bắt đầu bằng “${first}”, âm tiết 2 bắt đầu bằng “${second}”.`;
    }
  } else if (state.requiredSyllable) {
    els.targetLabel.textContent = "Từ cần nối";
    els.targetSyllable.textContent = state.requiredSyllable;
    els.targetSyllable.classList.remove("is-open");
    els.targetCard.classList.remove("is-open");
    els.targetHint.textContent = `Từ mới phải bắt đầu bằng “${state.requiredSyllable}” và có 2–5 âm tiết.`;
  } else {
    els.targetLabel.textContent = "Từ mở màn";
    els.targetSyllable.textContent = "Bất kỳ";
    els.targetSyllable.classList.add("is-open");
    els.targetCard.classList.add("is-open");
    els.targetHint.textContent = "Chọn một từ tiếng Việt có nghĩa, 2–5 âm tiết, chưa ai dùng.";
  }

  const recent = state.history.slice(-3);
  const separator = letters ? '<span class="chain-dot">·</span>' : '<span class="chain-arrow">→</span>';
  els.chainMini.innerHTML = recent.length
    ? recent
        .map((item, index) => {
          if (letters) {
            return `${index ? separator : ""}<span class="chain-chip">${esc(item.phrase)}</span>`;
          }
          const lastIndex = item.syllables.length - 1;
          const word = item.syllables
            .map((syllable, syllableIndex) =>
              syllableIndex === lastIndex ? `<strong>${esc(syllable)}</strong>` : esc(syllable)
            )
            .join(" ");
          return `${index ? separator : ""}<span class="chain-chip">${word}</span>`;
        })
        .join("")
    : letters
      ? '<span class="chain-empty">Chưa có từ nào. Cặp chữ cái đã được chọn cho cả ván.</span>'
      : '<span class="chain-empty">Chưa có từ nào. Người mở màn sẽ chọn từ đầu tiên.</span>';

  els.waitingTurn.hidden = myTurn && !awaitingPair;
  if (awaitingPair) {
    els.waitingTurnText.textContent = "Đang chờ chủ phòng chọn cặp chữ cái…";
  } else if (!myTurn) {
    els.waitingTurnText.textContent = current
      ? `Đang chờ ${currentName} nối từ…`
      : "Đang chờ người chơi tiếp theo…";
  }

  renderPairControl(state);
}

function renderPairControl(state) {
  const show =
    app.role === "host" &&
    state.phase === "playing" &&
    state.gameMode === "letters" &&
    state.pairMode === "manual" &&
    state.awaitingPair;

  els.pairControl.hidden = !show;
  if (!show) {
    els.pairError.textContent = "";
    return;
  }

  els.pairControlValue.textContent = "Chưa chọn";
  const key = String(state.turnSeq ?? state.turnPlayerId ?? "");
  if (app.pairFormKey !== key) {
    app.pairFormKey = key;
    els.pairInput1.value = "";
    els.pairInput2.value = "";
    els.pairError.textContent = "";
  }
}

function titleById(id) {
  return TITLE_MAP.get(id) || null;
}

function titleChipHtml(id) {
  const title = titleById(id);
  if (!title) return "";
  return `<span class="title-chip title-chip--${title.tone}" title="${esc(title.criteria)}"><span class="title-chip__mark" aria-hidden="true">${esc(title.mark)}</span>${esc(title.name)}</span>`;
}

function renderTitleRules() {
  els.titleRules.innerHTML = TITLE_RULES.map(
    (title) => `
      <li class="title-rule">
        <span class="title-mark title-mark--${title.tone}" aria-hidden="true">${esc(title.mark)}</span>
        <span class="title-rule__body">
          <strong>${esc(title.name)}</strong>
          <span>${esc(title.criteria)}</span>
        </span>
      </li>`
  ).join("");
}

function renderStageEnded(state) {
  const winners = state.winners
    .map((id) => state.players.find((player) => player.id === id))
    .filter(Boolean);

  if (winners.length === 0) {
    els.winnerTitle.textContent = "Ván đấu kết thúc";
    els.winnerSub.textContent = `Chưa có ai ghi điểm · ${state.usedCount} từ đã nối.`;
  } else if (winners.length === 1) {
    els.winnerTitle.innerHTML = `Chiến thắng: <span class="grad">${esc(winners[0].name)}</span>`;
    els.winnerSub.textContent = `${winners[0].score} điểm · ${state.usedCount} từ đã nối.`;
  } else {
    const names = winners.map((player) => esc(player.name)).join(", ");
    els.winnerTitle.innerHTML = `Đồng hạng: <span class="grad">${names}</span>`;
    els.winnerSub.textContent = `${winners[0].score} điểm mỗi người · ${state.usedCount} từ đã nối.`;
  }

  const winnerTitleIds = [
    ...new Set(winners.flatMap((player) => player.titleIds || [])),
  ];
  els.winnerTitles.innerHTML = winnerTitleIds.map((id) => titleChipHtml(id)).join("");

  const ranking = [...state.players].sort(
    (a, b) => b.score - a.score || a.name.localeCompare(b.name, "vi")
  );
  const topScore = ranking[0]?.score || 0;
  els.podium.innerHTML = ranking
    .map((player, index) => {
      const isFirst = topScore > 0 && player.score === topScore;
      const titleChips = (player.titleIds || []).map((id) => titleChipHtml(id)).join("");
      return `
        <li class="podium__row ${isFirst ? "is-first" : ""}">
          <span class="podium__rank">${index + 1}</span>
          <span class="avatar" style="--h:${hueOf(player.id)}" aria-hidden="true">${esc(initialsOf(player.name))}</span>
          <span class="podium__meta">
            <span class="podium__name">${esc(player.name)}${player.online ? "" : " (offline)"}</span>
            ${titleChips ? `<span class="podium__titles">${titleChips}</span>` : ""}
          </span>
          <span class="podium__score">${player.score} điểm</span>
        </li>`;
    })
    .join("");

  const titles = Array.isArray(state.titles) ? state.titles : [];
  const titleCards = titles
    .map((award) => {
      const title = titleById(award.id);
      if (!title) return "";
      const names = award.playerIds
        .map((id) => state.players.find((player) => player.id === id)?.name)
        .filter(Boolean)
        .join(", ");
      return `
        <li class="title-card title-card--${title.tone}">
          <span class="title-card__mark" aria-hidden="true">${esc(title.mark)}</span>
          <div class="title-card__body">
            <p class="title-card__label">Danh hiệu</p>
            <h4 class="title-card__name">${esc(title.name)}</h4>
            <p class="title-card__who">${esc(names)}</p>
            <p class="title-card__detail">${esc(award.detail)}</p>
          </div>
        </li>`;
    })
    .join("");
  els.titleBoardGrid.innerHTML = titleCards;
  els.titleBoard.hidden = titles.length === 0;
  els.titleCount.textContent = `${titles.length} danh hiệu`;

  els.endActions.innerHTML = "";
  if (app.role === "host") {
    const online = state.players.filter((player) => player.online).length;

    const again = document.createElement("button");
    again.type = "button";
    again.className = "btn btn--primary";
    again.textContent = "Chơi lại";
    again.disabled = online < 2;
    again.addEventListener("click", () => {
      try {
        app.game.restart(app.playerId);
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    const lobby = document.createElement("button");
    lobby.type = "button";
    lobby.className = "btn btn--ghost";
    lobby.textContent = "Về phòng chờ";
    lobby.addEventListener("click", () => {
      try {
        app.game.backToLobby(app.playerId);
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    els.endActions.append(again, lobby);
    if (online < 2) {
      const hint = document.createElement("p");
      hint.className = "wait-host";
      hint.textContent = "Cần ít nhất 2 người đang kết nối để chơi lại.";
      els.endActions.appendChild(hint);
    }
  } else {
    const wait = document.createElement("p");
    wait.className = "wait-host";
    wait.textContent = "Đang chờ chủ phòng bắt đầu ván mới…";
    els.endActions.appendChild(wait);
  }
}

function renderHistory(state) {
  const items = state.history.slice(-30).reverse();
  const latestN = state.history.length ? state.history[state.history.length - 1].n : 0;
  const isNew = latestN !== 0 && latestN !== app.lastHistoryN;
  app.lastHistoryN = latestN;

  els.usedCount.textContent = `${state.usedCount} từ`;
  els.historyEmpty.classList.toggle("hidden", items.length > 0);
  els.historyList.classList.toggle("hidden", items.length === 0);

  els.historyList.innerHTML = items
    .map((item) => {
      const lastIndex = item.syllables.length - 1;
      const word =
        state.gameMode === "letters"
          ? esc(item.phrase)
          : item.syllables
              .map((syllable, index) => {
                if (index === 0 && lastIndex !== 0) {
                  return `<span class="syl-first">${esc(syllable)}</span>`;
                }
                if (index === lastIndex) return `<span class="syl-last">${esc(syllable)}</span>`;
                return esc(syllable);
              })
              .join(" ");
      const pairBadge =
        state.gameMode === "letters" && Array.isArray(item.pair)
          ? `<span class="history__pair">${esc(pairText(item.pair))}</span>`
          : "";
      return `
        <li class="history__item" data-n="${item.n}">
          <span class="history__num">${item.n}</span>
          <span class="history__main">
            <span class="history__word">${pairBadge}${word}</span>
            <span class="history__player">${esc(item.playerName)}</span>
          </span>
        </li>`;
    })
    .join("");

  if (isNew) els.historyList.firstElementChild?.classList.add("is-new");
}

function updateAnswerForm(state = app.state) {
  const playing = state?.phase === "playing";
  const letters = state?.gameMode === "letters";
  const awaitingPair = Boolean(playing && state.awaitingPair);
  const myTurn = playing && state.turnPlayerId === app.playerId;
  const disabled = !myTurn || app.answerPending || awaitingPair;
  const current = playing ? state.players.find((player) => player.id === state.turnPlayerId) : null;

  els.answerInput.disabled = disabled;
  els.answerBtn.disabled = disabled;

  if (!playing) {
    els.answerInput.placeholder = "Nhập từ của bạn…";
  } else if (awaitingPair) {
    els.answerInput.placeholder = "Đang chờ chủ phòng chọn cặp chữ…";
  } else if (app.answerPending) {
    els.answerInput.placeholder = "Đang kiểm tra từ…";
  } else if (myTurn) {
    if (letters) {
      els.answerInput.placeholder = `Nhập 2 âm tiết theo cặp ${pairText(state.pair)}…`;
    } else {
      els.answerInput.placeholder = state.requiredSyllable
        ? `Bắt đầu bằng “${state.requiredSyllable}”…`
        : "Nhập từ mở màn…";
    }
  } else {
    els.answerInput.placeholder = current ? `Đang chờ ${current.name}…` : "Đang chờ…";
  }
}

function updateTimer() {
  const state = app.state;
  if (!state || state.phase !== "playing") return;

  if (state.awaitingPair) {
    els.timerRing.style.setProperty("--p", "0");
    els.timerText.textContent = "—";
    els.timerUnit.textContent = "chờ";
    els.timer.classList.remove("is-urgent");
    return;
  }

  const total = Math.max(1, (state.turnSeconds || TURN_SECONDS) * 1000);
  const left = Math.max(0, app.deadline - performance.now());
  const percent = Math.max(0, Math.min(100, (left / total) * 100));
  els.timerRing.style.setProperty("--p", String(percent));
  els.timerText.textContent = String(Math.ceil(left / 1000));
  els.timerUnit.textContent = "giây";
  els.timer.classList.toggle("is-urgent", left <= 10000);
}

function submitAnswer(event) {
  event?.preventDefault();
  const state = app.state;
  if (!state || state.phase !== "playing" || app.answerPending) return;
  if (state.turnPlayerId !== app.playerId) return;

  const text = els.answerInput.value;
  if (!text.trim()) {
    showAnswerError("Hãy nhập từ của bạn.");
    shakeAnswerForm();
    return;
  }

  clearAnswerError();

  if (app.role === "host") {
    if (!app.game) return;
    const result = app.game.submit(app.playerId, text);
    if (result.ok) {
      els.answerInput.value = "";
    } else {
      showAnswerError(result.reason);
      shakeAnswerForm();
    }
    return;
  }

  if (!app.conn?.open) {
    showAnswerError("Mất kết nối tới chủ phòng.");
    return;
  }

  app.answerPending = true;
  clearTimeout(app.answerTimeout);
  updateAnswerForm(state);

  try {
    app.conn.send({ t: "answer", text });
  } catch {
    app.answerPending = false;
    updateAnswerForm(state);
    showAnswerError("Không gửi được câu trả lời. Thử lại nhé.");
    return;
  }

  app.answerTimeout = setTimeout(() => {
    if (!app.answerPending) return;
    app.answerPending = false;
    updateAnswerForm();
    showAnswerError("Chủ phòng không phản hồi. Thử lại nhé.");
  }, 6000);
}

function handleAnswerResult(message) {
  if (!app.role) return;
  clearTimeout(app.answerTimeout);
  app.answerPending = false;

  if (message.ok) {
    els.answerInput.value = "";
    clearAnswerError();
  } else {
    showAnswerError(message.reason || "Từ chưa hợp lệ.");
    shakeAnswerForm();
  }
  updateAnswerForm();
}

function resetAnswerPending() {
  if (app.answerTimeout) {
    clearTimeout(app.answerTimeout);
    app.answerTimeout = null;
  }
  app.answerPending = false;
}

function showAnswerError(message) {
  els.answerError.textContent = message || "";
}

function clearAnswerError() {
  els.answerError.textContent = "";
}

function shakeAnswerForm() {
  els.answerForm.classList.remove("is-shaking");
  void els.answerForm.offsetWidth;
  els.answerForm.classList.add("is-shaking");
}

function requestLeave() {
  if (!app.role) {
    exitToHome();
    return;
  }

  const host = app.role === "host";
  const inGame = app.state?.phase === "playing";

  if (!host && !inGame) {
    doLeave();
    return;
  }

  showConfirm({
    title: host ? "Đóng phòng?" : "Rời phòng?",
    text: host
      ? "Bạn là chủ phòng. Rời đi sẽ ngắt kết nối của tất cả mọi người và đóng phòng này."
      : "Bạn đang trong ván đấu. Rời phòng sẽ mất lượt và điểm hiện tại của bạn.",
    confirmLabel: host ? "Đóng phòng" : "Rời phòng",
    cancelLabel: "Ở lại",
    danger: true,
    onConfirm: doLeave,
  });
}

function doLeave() {
  const role = app.role;
  app.role = null;
  stopPresence();

  if (role === "host") {
    publishPresenceClosed();
    for (const conn of app.conns.values()) {
      try {
        conn.send({ t: "closed" });
      } catch {
        /* ignore */
      }
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
    app.conns.clear();
    try {
      app.game?.destroy();
    } catch {
      /* ignore */
    }
    try {
      app.peer?.destroy();
    } catch {
      /* ignore */
    }
  } else if (role === "guest") {
    try {
      app.conn?.send({ t: "leave" });
    } catch {
      /* ignore */
    }
    try {
      app.conn?.close();
    } catch {
      /* ignore */
    }
    try {
      app.peer?.destroy();
    } catch {
      /* ignore */
    }
  }

  resetRoomState();
  hideOverlay();
  exitToHome();
  showToast("Đã rời phòng.", "info");
}

/* ---------- Phòng công khai qua MQTT (không cần backend riêng) ---------- */

function setupDirectory() {
  app.directoryStatus = "connecting";
  app.directory = new LobbyDirectory({
    onRooms: (rooms) => {
      app.rooms = rooms;
      renderLobbyRooms();
    },
    onStatus: (status) => {
      app.directoryStatus = status;
      updateLobbyStatus(status);
    },
  });
  app.directory.start();
}

function updateLobbyStatus(status) {
  if (status === "online") {
    els.lobbyLive.classList.remove("is-off");
    els.lobbyLiveText.textContent = "Trực tuyến";
    els.lobbyNote.hidden = true;
    if (app.role === "host") publishPresence();
  } else if (status === "offline") {
    els.lobbyLive.classList.add("is-off");
    els.lobbyLiveText.textContent = "Ngoại tuyến";
    els.lobbyNote.hidden = false;
    els.lobbyNote.textContent =
      "Không kết nối được danh sách phòng công khai. Bạn vẫn có thể tạo phòng mới hoặc nhập mã phòng để vào.";
  } else {
    els.lobbyLive.classList.add("is-off");
    els.lobbyLiveText.textContent = "Đang kết nối";
    els.lobbyNote.hidden = true;
  }
  renderLobbyRooms();
}

function renderLobbyRooms() {
  const rooms = app.rooms.slice(0, 12);

  if (!rooms.length) {
    let message = "Chưa có phòng nào đang mở. Tạo phòng mới để bắt đầu!";
    if (app.directoryStatus === "offline") {
      message = "Danh sách phòng công khai đang tạm thời không khả dụng. Hãy tạo phòng hoặc nhập mã phòng.";
    } else if (app.directoryStatus === "connecting") {
      message = "Đang tìm các phòng đang mở…";
    }
    els.roomList.innerHTML = `<div class="lobby-empty">${esc(message)}</div>`;
    return;
  }

  els.roomList.innerHTML = rooms
    .map((room, index) => {
      const statusLabel =
        room.phase === "playing" ? "Đang chơi" : room.phase === "ended" ? "Chờ ván mới" : "Đang chờ";
      const statusClass = room.phase === "playing" ? "is-playing" : "is-waiting";
      return `
        <article class="room-card">
          <span class="room-card__index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <span class="room-card__code">
            <span class="room-card__code-value">${esc(room.code)}</span>
            <span class="room-card__code-label">Mã bàn</span>
          </span>
          <span class="room-card__host">
            <span class="mini-avatar" style="--h:${hueOf(room.code + room.host)}" aria-hidden="true">${esc(initialsOf(room.host))}</span>
            <span class="room-card__host-copy">
              <small>Chủ bàn</small>
              <strong title="${esc(room.host)}">${esc(room.host)}</strong>
            </span>
          </span>
          <div class="room-card__tags">
            <span class="room-card__mode ${room.gameMode === "letters" ? "is-letters" : ""}">${room.gameMode === "letters" ? "Đôi chữ cái" : "Nối từ"}</span>
            <span class="room-card__status ${statusClass}">${statusLabel}</span>
          </div>
          <span class="room-card__players">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <strong>${room.players}</strong><span>/${room.max}</span>
          </span>
          <button class="room-card__join" type="button" data-join-code="${esc(room.code)}">
            Vào bàn
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
          </button>
        </article>`;
    })
    .join("");
}

function publishPresence() {
  if (app.role !== "host" || !app.state || !app.directory || app.directory.status !== "online") return;
  const state = app.state;
  const host = state.players.find((player) => player.isHost)?.name || "Chủ phòng";
  app.directory.publishRoom({
    code: app.roomCode,
    host,
    players: state.players.length,
    max: MAX_PLAYERS,
    phase: state.phase,
    mode: state.mode,
    gameMode: state.gameMode,
  });
}

function publishPresenceClosed() {
  if (app.roomCode && app.directory) app.directory.publishClosed(app.roomCode);
}

function startPresence() {
  stopPresence();
  publishPresence();
  app.presenceTimer = setInterval(publishPresence, 7000);
}

function stopPresence() {
  if (app.presenceTimer) {
    clearInterval(app.presenceTimer);
    app.presenceTimer = null;
  }
}

/* ---------- Khởi động ---------- */

function applyInviteHash(initial = false) {
  if (app.role) return;
  const match = window.location.hash.match(/^#\/p\/([A-Za-z0-9]{5})$/);
  if (!match) return;
  const code = match[1].toUpperCase();
  els.codeInput.value = code;
  if (initial) {
    showToast(`Đã điền mã phòng ${code}. Nhập tên rồi bấm “Vào phòng”.`, "info", 5000);
    setTimeout(() => els.nameInput.focus(), 300);
  }
}

function openRules() {
  if (typeof els.rulesDialog.showModal === "function") {
    if (!els.rulesDialog.open) els.rulesDialog.showModal();
  } else {
    els.rulesDialog.setAttribute("open", "");
  }
}

function closeRules() {
  if (typeof els.rulesDialog.close === "function") els.rulesDialog.close();
  else els.rulesDialog.removeAttribute("open");
}

function bindEvents() {
  els.nameInput.addEventListener("input", () => {
    saveName(els.nameInput.value);
    showHomeError("");
    showCreateError("");
  });

  els.nameInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (cleanCode(els.codeInput.value).length === CODE_LENGTH) joinRoom();
    else els.createBtn.focus();
  });

  els.codeInput.addEventListener("input", () => {
    const clean = cleanCode(els.codeInput.value);
    if (els.codeInput.value !== clean) els.codeInput.value = clean;
    showHomeError("");
  });

  els.codeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      joinRoom();
    }
  });

  els.createBtn.addEventListener("click", createRoom);
  els.joinBtn.addEventListener("click", () => joinRoom());

  els.recentList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-code]");
    if (!button) return;
    els.codeInput.value = cleanCode(button.dataset.code);
    els.codeInput.focus();
    showHomeError("");
  });

  els.roomList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-join-code]");
    if (!button) return;
    const code = cleanCode(button.dataset.joinCode);
    els.codeInput.value = code;
    if (!sanitizeName(els.nameInput.value, "")) {
      showHomeError("Nhập tên của bạn trước khi vào phòng.");
      els.nameInput.focus();
      return;
    }
    joinRoom(code);
  });

  els.startBtn.addEventListener("click", () => {
    try {
      app.game?.start(app.playerId);
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  els.endBtn.addEventListener("click", () => {
    showConfirm({
      title: "Kết thúc ván?",
      text: "Bảng điểm sẽ được chốt lại. Bạn vẫn có thể chơi lại hoặc quay về phòng chờ.",
      confirmLabel: "Kết thúc",
      cancelLabel: "Tiếp tục chơi",
      danger: true,
      onConfirm: () => {
        try {
          app.game?.end(app.playerId);
        } catch (error) {
          showToast(error.message, "error");
        }
      },
    });
  });

  els.gameModeSelect.addEventListener("change", () => {
    try {
      app.game?.setGameMode(els.gameModeSelect.value);
    } catch (error) {
      showToast(error.message, "error");
      renderRoom();
    }
  });

  els.pairModeSelect.addEventListener("change", () => {
    try {
      app.game?.setPairMode(els.pairModeSelect.value);
    } catch (error) {
      showToast(error.message, "error");
      renderRoom();
    }
  });

  els.modeSelect.addEventListener("change", () => {
    try {
      app.game?.setMode(els.modeSelect.value);
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  els.pairInput1.addEventListener("input", () => {
    els.pairInput1.value = Array.from(els.pairInput1.value.trim()).slice(0, 1).join("");
    els.pairError.textContent = "";
    if (els.pairInput1.value) els.pairInput2.focus();
  });

  els.pairInput2.addEventListener("input", () => {
    els.pairInput2.value = Array.from(els.pairInput2.value.trim()).slice(0, 1).join("");
    els.pairError.textContent = "";
  });

  els.pairForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!app.game) return;
    try {
      app.game.setPair(app.playerId, els.pairInput1.value, els.pairInput2.value);
    } catch (error) {
      els.pairError.textContent = error.message;
    }
  });

  els.randomPairBtn.addEventListener("click", () => {
    if (!app.game) return;
    try {
      app.game.randomizePair(app.playerId);
    } catch (error) {
      els.pairError.textContent = error.message;
    }
  });

  els.answerForm.addEventListener("submit", submitAnswer);
  els.answerInput.addEventListener("input", clearAnswerError);

  els.leaveBtn.addEventListener("click", requestLeave);
  els.brandHome.addEventListener("click", () => {
    if (app.role) requestLeave();
    else window.scrollTo({ top: 0, behavior: "smooth" });
  });

  els.roomCodeBtn.addEventListener("click", () => {
    if (app.roomCode) copyText(app.roomCode, `Đã sao chép mã phòng ${app.roomCode}.`);
  });
  els.inviteBtn.addEventListener("click", copyInvite);
  els.lobbyInviteBtn.addEventListener("click", copyInvite);

  els.howToBtn.addEventListener("click", openRules);
  els.roomRulesBtn.addEventListener("click", openRules);
  els.closeRulesBtn.addEventListener("click", closeRules);
  els.okRulesBtn.addEventListener("click", closeRules);
  els.rulesDialog.addEventListener("click", (event) => {
    if (event.target === els.rulesDialog) closeRules();
  });

  els.overlay.addEventListener("click", (event) => {
    if (event.target === els.overlay && els.overlay.dataset.dismissible === "1") hideOverlay();
  });

  window.addEventListener("hashchange", () => applyInviteHash(false));
  window.addEventListener("beforeunload", () => {
    if (app.role === "host") publishPresenceClosed();
  });
}

function boot() {
  els.nameInput.value = loadSavedName();
  renderRecentRooms();
  renderTitleRules();
  setupDirectory();
  bindEvents();
  applyInviteHash(true);
  setInterval(updateTimer, 150);
}

boot();
