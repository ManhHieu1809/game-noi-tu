import { cleanCode, generateCode, getPeerOptions } from "../net.js";
import {
  addPlayer,
  createIslandState,
  removePlayer,
  resetToLobby,
  serializeState,
  startGame,
  tickGame,
  updatePose,
} from "./core.js";

export const ISLAND_PEER_PREFIX = "island-";
const SNAPSHOT_MS = 80;

function networkError(error) {
  const type = error?.type;
  if (type === "peer-unavailable") return "Không tìm thấy phòng. Chủ phòng có thể đã đóng phòng.";
  if (type === "unavailable-id") return "Mã phòng đang được dùng. Hãy thử tạo lại.";
  if (type === "browser-incompatible") return "Trình duyệt này không hỗ trợ kết nối ngang hàng (WebRTC).";
  if (["network", "server-error", "socket-error", "socket-closed"].includes(type)) {
    return "Không kết nối được máy chủ ghép phòng. Kiểm tra mạng rồi thử lại.";
  }
  return error?.message || "Có lỗi kết nối. Thử lại nhé.";
}

function waitForPeerOpen(peer, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error("Hết thời gian kết nối.")), timeoutMs);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      peer.off("open", onOpen);
      peer.off("error", onError);
      if (error) reject(error);
      else resolve(peer);
    }
    function onOpen() {
      finish();
    }
    function onError(error) {
      finish(Object.assign(new Error(networkError(error)), { type: error?.type }));
    }
    peer.on("open", onOpen);
    peer.on("error", onError);
  });
}

function safeSend(conn, payload) {
  if (!conn?.open) return false;
  try {
    conn.send(payload);
    return true;
  } catch {
    return false;
  }
}

export class IslandHost {
  constructor({ peer, code, state, onSnapshot, onEvent, onError }) {
    this.peer = peer;
    this.code = code;
    this.state = state;
    this.onSnapshot = onSnapshot;
    this.onEvent = onEvent;
    this.onError = onError;
    this.conns = new Map();
    this.lastSnapshotAt = 0;
    this.closed = false;
    this.playerId = peer.id;

    peer.on("connection", (conn) => this.accept(conn));
    peer.on("error", (error) => {
      if (!this.closed) this.onError?.(networkError(error));
    });
    peer.on("disconnected", () => {
      if (!this.closed) {
        try {
          peer.reconnect();
        } catch {
          /* ignore */
        }
      }
    });
  }

  get snapshot() {
    return serializeState(this.state);
  }

  accept(conn) {
    let accepted = false;
    let timeout = setTimeout(() => conn.close(), 8000);

    conn.on("data", (message) => {
      if (!message || typeof message !== "object") return;
      if (message.t === "hello") {
        if (accepted) return;
        clearTimeout(timeout);
        const result = addPlayer(this.state, { id: conn.peer, name: message.name });
        if (!result.ok) {
          safeSend(conn, { t: "rejected", reason: result.reason });
          setTimeout(() => {
            try {
              conn.close();
            } catch {
              /* ignore */
            }
          }, 250);
          return;
        }
        accepted = true;
        this.conns.set(conn.peer, conn);
        safeSend(conn, {
          t: "welcome",
          playerId: conn.peer,
          state: serializeState(this.state),
        });
        this.onEvent?.({ type: "join", name: result.player.name });
        this.broadcast(true);
      } else if (message.t === "pose" && accepted) {
        if (this.state.phase === "playing") updatePose(this.state, conn.peer, message.pose);
      } else if (message.t === "leave" && accepted) {
        try {
          conn.close();
        } catch {
          /* ignore */
        }
      }
    });

    conn.on("close", () => {
      clearTimeout(timeout);
      if (!accepted) return;
      accepted = false;
      this.conns.delete(conn.peer);
      const removed = removePlayer(this.state, conn.peer);
      if (removed) this.onEvent?.({ type: "leave", name: removed.name });
      this.broadcast(true);
    });

    conn.on("error", () => {
      /* close handles cleanup */
    });
  }

  setLocalPose(pose) {
    updatePose(this.state, this.playerId, pose);
  }

  start(now = Date.now()) {
    const result = startGame(this.state, now);
    if (result.ok) this.broadcast(true);
    return result;
  }

  toLobby() {
    const result = resetToLobby(this.state);
    this.broadcast(true);
    return result;
  }

  tick(now = Date.now(), dt = 0, force = false) {
    const events = tickGame(this.state, now, dt);
    for (const event of events) this.onEvent?.(event);
    if (force || now - this.lastSnapshotAt >= SNAPSHOT_MS) {
      this.broadcast(false, now);
    }
    return events;
  }

  broadcast(force = false, now = Date.now()) {
    if (this.closed) return;
    if (!force && now - this.lastSnapshotAt < SNAPSHOT_MS) return;
    this.lastSnapshotAt = now;
    const snapshot = serializeState(this.state, now);
    for (const conn of this.conns.values()) safeSend(conn, { t: "state", state: snapshot });
    this.onSnapshot?.(snapshot);
  }

  close(reason = "Chủ phòng đã đóng phòng.") {
    if (this.closed) return;
    this.closed = true;
    for (const conn of this.conns.values()) {
      safeSend(conn, { t: "closed", reason });
      try {
        conn.close();
      } catch {
        /* ignore */
      }
    }
    this.conns.clear();
    try {
      this.peer.destroy();
    } catch {
      /* ignore */
    }
  }
}

export async function createIslandRoom({ name, onSnapshot, onEvent, onError }) {
  if (!window.Peer) throw new Error("Không tải được thư viện kết nối. Kiểm tra mạng rồi tải lại trang.");
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const code = generateCode();
    const peer = new window.Peer(`${ISLAND_PEER_PREFIX}${code}`, getPeerOptions());
    try {
      await waitForPeerOpen(peer);
      const state = createIslandState({ hostId: peer.id, hostName: name });
      return new IslandHost({ peer, code, state, onSnapshot, onEvent, onError });
    } catch (error) {
      lastError = error;
      try {
        peer.destroy();
      } catch {
        /* ignore */
      }
      if (error.type === "unavailable-id") continue;
    }
  }
  throw new Error(networkError(lastError));
}

export async function joinIslandRoom({ code, name, onSnapshot, onClosed, onEvent }) {
  if (!window.Peer) throw new Error("Không tải được thư viện kết nối. Kiểm tra mạng rồi tải lại trang.");
  const normalized = cleanCode(code);
  if (normalized.length !== 5) throw new Error("Mã phòng phải có đủ 5 ký tự.");

  return new Promise((resolve, reject) => {
    const peer = new window.Peer(getPeerOptions());
    let settled = false;
    let conn = null;
    let intentional = false;
    const timers = new Set();
    const later = (fn, ms) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
    };
    const clearTimers = () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    };
    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimers();
      intentional = true;
      try {
        conn?.close();
      } catch {
        /* ignore */
      }
      try {
        peer.destroy();
      } catch {
        /* ignore */
      }
      reject(new Error(message));
    };

    peer.on("error", (error) => {
      if (!settled) fail(networkError(error));
      else if (!intentional) onEvent?.({ type: "network", message: networkError(error) });
    });
    later(() => fail("Hết thời gian kết nối. Thử lại nhé."), 16000);

peer.on("open", () => {
      if (settled) return;
      try {
        conn = peer.connect(`${ISLAND_PEER_PREFIX}${normalized}`, { reliable: true, serialization: "json" });
      } catch {
        fail("Không tạo được kết nối tới phòng.");
        return;
      }

      function onData(message) {
        if (!message || typeof message !== "object") return;
        if (message.t === "welcome" && !settled) {
          settled = true;
          clearTimers();
          conn.off("data", onData);
          conn.off("close", onClose);
          const client = new IslandClient({
            peer,
            conn,
            code: normalized,
            playerId: message.playerId,
            state: message.state,
            onSnapshot,
            onClosed,
            onEvent,
          });
          resolve(client);
        } else if (message.t === "rejected" && !settled) {
          fail(message.reason || "Không vào được phòng.");
        } else if (message.t === "state" && settled) {
          onSnapshot?.(message.state);
        } else if (message.t === "closed" && settled) {
          intentional = true;
          onClosed?.(message.reason || "Chủ phòng đã đóng phòng.");
        }
      }

      function onClose() {
        if (!settled) fail("Mất kết nối tới chủ phòng. Có thể phòng đã đóng.");
        else if (!intentional) onClosed?.("Mất kết nối tới chủ phòng. Có thể phòng đã đóng.");
      }

      conn.on("data", onData);
      conn.on("open", () => {
        conn.send({ t: "hello", name });
      });
      conn.on("close", onClose);
      conn.on("error", () => {
        if (!settled) fail("Lỗi kết nối tới phòng.");
      });
    });
  });
}

export class IslandClient {
  constructor({ peer, conn, code, playerId, state, onSnapshot, onClosed, onEvent }) {
    this.peer = peer;
    this.conn = conn;
    this.code = code;
    this.playerId = playerId;
    this.state = state;
    this.onSnapshot = onSnapshot;
    this.onClosed = onClosed;
    this.onEvent = onEvent;
    this.closed = false;
    this.lastPoseAt = 0;

    this.conn.on("data", (message) => {
      if (!message || typeof message !== "object") return;
      if (message.t === "state" && message.state?.snapshotSeq > (this.state?.snapshotSeq ?? -1)) {
        this.state = message.state;
        onSnapshot?.(message.state);
      }
      else if (message.t === "closed") {
        this.close();
        onClosed?.(message.reason || "Chủ phòng đã đóng phòng.");
      }
    });
    this.conn.on("close", () => {
      if (!this.closed) {
        this.close();
        onClosed?.("Mất kết nối tới chủ phòng. Có thể phòng đã đóng.");
      }
    });
  }

  setSnapshot(state) {
    this.state = state;
  }

  sendPose(pose, now = Date.now()) {
    if (this.closed || now - this.lastPoseAt < 66) return;
    this.lastPoseAt = now;
    safeSend(this.conn, { t: "pose", pose });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    safeSend(this.conn, { t: "leave" });
    try {
      this.conn.close();
    } catch {
      /* ignore */
    }
    try {
      this.peer.destroy();
    } catch {
      /* ignore */
    }
  }
}
