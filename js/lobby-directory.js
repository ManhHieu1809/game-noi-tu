import { sanitizeName } from "./game-core.js";
import { cleanCode, CODE_LENGTH } from "./net.js";

export const MQTT_URL = "wss://broker.emqx.io:8084/mqtt";
export const MQTT_TOPIC = "noitu/v1/lobby";
export const ROOM_STALE_MS = 32000;

export class LobbyDirectory {
  constructor({ onRooms = () => {}, onStatus = () => {} } = {}) {
    this.onRooms = onRooms;
    this.onStatus = onStatus;
    this.client = null;
    this.connected = false;
    this.checked = false;
    this.failed = false;
    this.started = false;
    this.rooms = new Map();
    this.pruneTimer = null;
    this.checkTimer = null;
  }

  get status() {
    if (this.connected) return "online";
    if (this.failed || this.checked) return "offline";
    return "connecting";
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.onStatus(this.status);

    if (!window.mqtt || typeof window.mqtt.connect !== "function") {
      this.failed = true;
      this.checked = true;
      this.onStatus(this.status);
      return;
    }

    try {
      this.client = window.mqtt.connect(MQTT_URL, {
        clientId: `noitu_ui_${Math.random().toString(16).slice(2, 12)}`,
        keepalive: 30,
        clean: true,
        connectTimeout: 9000,
        reconnectPeriod: 12000,
      });
    } catch {
      this.failed = true;
      this.checked = true;
      this.onStatus(this.status);
      return;
    }

    this.client.on("connect", () => {
      this.connected = true;
      this.failed = false;
      this.checked = true;
      this.client.subscribe(`${MQTT_TOPIC}/+`, { qos: 0 });
      this.onStatus(this.status);
      this.emitRooms();
    });

    this.client.on("message", (topic, payload) => this.handleMessage(topic, payload));

    this.client.on("close", () => {
      this.connected = false;
      this.onStatus(this.status);
    });

    this.client.on("offline", () => {
      this.connected = false;
      this.onStatus(this.status);
    });

    this.client.on("error", () => {
      this.failed = true;
      this.onStatus(this.status);
    });

    this.checkTimer = setInterval(() => {
      if (!this.checked && !this.connected) {
        this.checked = true;
        this.failed = true;
        this.onStatus(this.status);
      }
    }, 10000);

    this.pruneTimer = setInterval(() => this.prune(), 5000);
  }

  handleMessage(topic, payload) {
    if (!topic.startsWith(`${MQTT_TOPIC}/`)) return;
    if (payload.length > 600) return;

    let data;
    try {
      data = JSON.parse(payload.toString());
    } catch {
      return;
    }

    if (!data || data.v !== 1) return;
    const code = cleanCode(data.code);
    if (code.length !== CODE_LENGTH || topic !== `${MQTT_TOPIC}/${code}`) return;
    if (typeof data.ts !== "number" || Date.now() - data.ts > ROOM_STALE_MS) return;

    if (data.closed) {
      this.rooms.delete(code);
    } else {
      this.rooms.set(code, {
        code,
        host: sanitizeName(data.host, "Chủ phòng"),
        players: Math.max(0, Math.min(10, Math.round(Number(data.players) || 0))),
        max: Math.max(2, Math.min(10, Math.round(Number(data.max) || 10))),
        phase: ["lobby", "playing", "ended"].includes(data.phase) ? data.phase : "lobby",
        mode: data.mode === "strict" ? "strict" : "smart",
        gameMode: data.gameMode === "letters" ? "letters" : "chain",
        ts: data.ts,
      });
    }

    this.emitRooms();
  }

  publishRoom({ code, host, players, max, phase, mode, gameMode }) {
    if (!this.client || !this.connected) return;
    const info = {
      v: 1,
      code,
      host,
      players,
      max,
      phase,
      mode,
      gameMode: gameMode === "letters" ? "letters" : "chain",
      ts: Date.now(),
    };
    try {
      this.client.publish(`${MQTT_TOPIC}/${code}`, JSON.stringify(info), { qos: 0 });
    } catch {
      /* ignore */
    }
  }

  publishClosed(code) {
    if (!this.client || !this.connected) return;
    try {
      this.client.publish(
        `${MQTT_TOPIC}/${code}`,
        JSON.stringify({ v: 1, code, closed: true, ts: Date.now() }),
        { qos: 0 }
      );
    } catch {
      /* ignore */
    }
  }

  prune() {
    const now = Date.now();
    let changed = false;
    for (const [code, room] of this.rooms) {
      if (now - room.ts > ROOM_STALE_MS) {
        this.rooms.delete(code);
        changed = true;
      }
    }
    if (changed) this.emitRooms();
  }

  emitRooms() {
    const rooms = [...this.rooms.values()]
      .filter((room) => Date.now() - room.ts <= ROOM_STALE_MS)
      .sort((a, b) => {
        const order = { lobby: 0, playing: 1, ended: 2 };
        return order[a.phase] - order[b.phase] || b.players - a.players || b.ts - a.ts;
      });
    this.onRooms(rooms);
  }

  stop() {
    clearInterval(this.pruneTimer);
    clearInterval(this.checkTimer);
    this.pruneTimer = null;
    this.checkTimer = null;
    try {
      this.client?.end(true);
    } catch {
      /* ignore */
    }
    this.client = null;
    this.connected = false;
    this.started = false;
  }
}
