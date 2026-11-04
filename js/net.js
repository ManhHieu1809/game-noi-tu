export const PEER_ID_PREFIX = "noitu-";
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 5;

const ICE_SERVERS = [
  {
    urls: "stun:stun.relay.metered.ca:80",
  },
  {
    urls: "turn:standard.relay.metered.ca:80",
    username: "55e82a2f98c700fac27a9338",
    credential: "TpRPCUPUJJF/c+qK",
  },
  {
    urls: "turn:standard.relay.metered.ca:80?transport=tcp",
    username: "55e82a2f98c700fac27a9338",
    credential: "TpRPCUPUJJF/c+qK",
  },
  {
    urls: "turn:standard.relay.metered.ca:443",
    username: "55e82a2f98c700fac27a9338",
    credential: "TpRPCUPUJJF/c+qK",
  },
  {
    urls: "turns:standard.relay.metered.ca:443?transport=tcp",
    username: "55e82a2f98c700fac27a9338",
    credential: "TpRPCUPUJJF/c+qK",
  },
];

export function cleanCode(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);
}

export function generateCode() {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function peerOptions() {
  return { debug: 1, config: { iceServers: ICE_SERVERS } };
}

function waitForPeerOpen(peer, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(Object.assign(new Error("Hết thời gian kết nối."), { type: "timeout" })), timeoutMs);

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
      finish(Object.assign(new Error(error?.message || error?.type || "Lỗi kết nối."), { type: error?.type }));
    }

    peer.on("open", onOpen);
    peer.on("error", onError);
  });
}

export async function createRoomPeer() {
  if (!window.Peer) {
    throw new Error("Không tải được thư viện kết nối. Kiểm tra mạng rồi tải lại trang.");
  }

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const code = generateCode();
    const peer = new window.Peer(`${PEER_ID_PREFIX}${code}`, peerOptions());
    try {
      await waitForPeerOpen(peer, 10000);
      return { code, peer };
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

  if (lastError?.type === "unavailable-id") {
    throw new Error("Không tìm được mã phòng trống. Hãy thử lại.");
  }
  throw new Error("Không kết nối được máy chủ ghép phòng. Kiểm tra mạng rồi thử lại.");
}

export function connectToRoom(code, name, quizSeen = {}) {
  return new Promise((resolve, reject) => {
    if (!window.Peer) {
      reject(new Error("Không tải được thư viện kết nối. Kiểm tra mạng rồi tải lại trang."));
      return;
    }

    const peer = new window.Peer(peerOptions());
    let conn = null;
    let settled = false;
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

    const onPeerError = (error) => {
      const type = error?.type;
      if (type === "peer-unavailable") {
        fail(`Không tìm thấy phòng ${code}. Có thể chủ phòng đã rời đi.`);
      } else if (type === "browser-incompatible") {
        fail("Trình duyệt này không hỗ trợ kết nối ngang hàng (WebRTC).");
      } else if (["network", "server-error", "socket-error", "socket-closed"].includes(type)) {
        fail("Không kết nối được máy chủ ghép phòng. Kiểm tra mạng rồi thử lại.");
      } else {
        fail(error?.message || "Không kết nối được tới phòng.");
      }
    };

    peer.on("error", onPeerError);
    later(() => fail("Hết thời gian kết nối. Thử lại nhé."), 16000);

    peer.on("open", () => {
      try {
        conn = peer.connect(`${PEER_ID_PREFIX}${code}`, { reliable: true, serialization: "json" });
      } catch {
        fail("Không tạo được kết nối tới phòng.");
        return;
      }

      const onData = (message) => {
        if (!message || typeof message !== "object" || settled) return;
        if (message.t === "welcome") {
          settled = true;
          clearTimers();
          conn.off("data", onData);
          peer.off("error", onPeerError);
          resolve({ peer, conn, playerId: message.playerId, state: message.state });
        } else if (message.t === "rejected") {
          fail(message.reason || "Không vào được phòng.");
        }
      };

      conn.on("data", onData);
      conn.on("open", () => {
        conn.send({ t: "hello", name, quizSeen });
      });
      conn.on("close", () => {
        if (!settled) fail("Mất kết nối tới chủ phòng. Có thể phòng đã đóng.");
      });
      conn.on("error", () => {
        if (!settled) fail("Lỗi kết nối tới phòng.");
      });
    });
  });
}
