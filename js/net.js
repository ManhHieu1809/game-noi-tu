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

export function getPeerOptions() {
  return { debug: 1, config: { iceServers: ICE_SERVERS } };
}

function waitForPeerOpen(peer, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(Object.assign(new Error("Háº¿t thá»i gian káº¿t ná»‘i."), { type: "timeout" })), timeoutMs);

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
      finish(Object.assign(new Error(error?.message || error?.type || "Lá»—i káº¿t ná»‘i."), { type: error?.type }));
    }

    peer.on("open", onOpen);
    peer.on("error", onError);
  });
}

export async function createRoomPeer() {
  if (!window.Peer) {
    throw new Error("KhĂ´ng táº£i Ä‘Æ°á»£c thÆ° viá»‡n káº¿t ná»‘i. Kiá»ƒm tra máº¡ng rá»“i táº£i láº¡i trang.");
  }

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const code = generateCode();
    const peer = new window.Peer(`${PEER_ID_PREFIX}${code}`, getPeerOptions());
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
    throw new Error("KhĂ´ng tĂ¬m Ä‘Æ°á»£c mĂ£ phĂ²ng trá»‘ng. HĂ£y thá»­ láº¡i.");
  }
  throw new Error("KhĂ´ng káº¿t ná»‘i Ä‘Æ°á»£c mĂ¡y chá»§ ghĂ©p phĂ²ng. Kiá»ƒm tra máº¡ng rá»“i thá»­ láº¡i.");
}

export function connectToRoom(code, name) {
  return new Promise((resolve, reject) => {
    if (!window.Peer) {
      reject(new Error("KhĂ´ng táº£i Ä‘Æ°á»£c thÆ° viá»‡n káº¿t ná»‘i. Kiá»ƒm tra máº¡ng rá»“i táº£i láº¡i trang."));
      return;
    }

    const peer = new window.Peer(getPeerOptions());
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
        fail(`KhĂ´ng tĂ¬m tháº¥y phĂ²ng ${code}. CĂ³ thá»ƒ chá»§ phĂ²ng Ä‘Ă£ rá»i Ä‘i.`);
      } else if (type === "browser-incompatible") {
        fail("TrĂ¬nh duyá»‡t nĂ y khĂ´ng há»— trá»£ káº¿t ná»‘i ngang hĂ ng (WebRTC).");
      } else if (["network", "server-error", "socket-error", "socket-closed"].includes(type)) {
        fail("KhĂ´ng káº¿t ná»‘i Ä‘Æ°á»£c mĂ¡y chá»§ ghĂ©p phĂ²ng. Kiá»ƒm tra máº¡ng rá»“i thá»­ láº¡i.");
      } else {
        fail(error?.message || "KhĂ´ng káº¿t ná»‘i Ä‘Æ°á»£c tá»›i phĂ²ng.");
      }
    };

    peer.on("error", onPeerError);
    later(() => fail("Háº¿t thá»i gian káº¿t ná»‘i. Thá»­ láº¡i nhĂ©."), 16000);

    peer.on("open", () => {
      try {
        conn = peer.connect(`${PEER_ID_PREFIX}${code}`, { reliable: true, serialization: "json" });
      } catch {
        fail("KhĂ´ng táº¡o Ä‘Æ°á»£c káº¿t ná»‘i tá»›i phĂ²ng.");
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
          fail(message.reason || "KhĂ´ng vĂ o Ä‘Æ°á»£c phĂ²ng.");
        }
      };

      conn.on("data", onData);
      conn.on("open", () => {
        conn.send({ t: "hello", name });
      });
      conn.on("close", () => {
        if (!settled) fail("Máº¥t káº¿t ná»‘i tá»›i chá»§ phĂ²ng. CĂ³ thá»ƒ phĂ²ng Ä‘Ă£ Ä‘Ă³ng.");
      });
      conn.on("error", () => {
        if (!settled) fail("Lá»—i káº¿t ná»‘i tá»›i phĂ²ng.");
      });
    });
  });
}

