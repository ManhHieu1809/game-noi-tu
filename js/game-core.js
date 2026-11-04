import { ImageQuizRound, IMAGE_QUIZ_SECONDS, IMAGE_QUIZ_REVEAL_MS, IMAGE_QUIZ_IDIOM, IMAGE_QUIZ_OBJECT } from "./games/image-quiz/image-quiz-core.js";

export const MIN_SYLLABLES = 2;
export const MAX_SYLLABLES = 5;
export const MAX_PLAYERS = 10;
export const TURN_SECONDS = 45;
export const DEFAULT_MODE = "smart";

export const GAME_MODE_CHAIN = "chain";
export const GAME_MODE_LETTERS = "letters";
export const GAME_MODE_IMAGE = "image";
export const PAIR_MODE_RANDOM = "random";
export const PAIR_MODE_MANUAL = "manual";

export const TITLE_RULES = [
  {
    id: "king",
    name: "Vua Tiếng Việt",
    mark: "V",
    tone: "gold",
    criteria: "Người thắng ván. Nếu đồng hạng, các người thắng cùng nhận.",
  },
  {
    id: "syllableMaster",
    name: "Bậc thầy âm tiết",
    mark: "Â",
    tone: "sky",
    criteria: "Tổng số âm tiết của các từ đúng nhiều nhất. Cần ít nhất 6 âm tiết.",
  },
  {
    id: "lightning",
    name: "Tia chớp",
    mark: "T",
    tone: "mint",
    criteria: "Thời gian trả lời trung bình nhanh nhất. Cần ít nhất 2 câu đúng.",
  },
  {
    id: "creator",
    name: "Nhà sáng tạo",
    mark: "S",
    tone: "violet",
    criteria: "Nhiều từ hợp lệ ngoài nguyên cụm từ điển nhất. Cần ít nhất 2 từ; chỉ ở chế độ Thông minh.",
  },
  {
    id: "flawless",
    name: "Bách phát bách trúng",
    mark: "B",
    tone: "rose",
    criteria: "Có ít nhất 3 câu đúng, không nhập sai lần nào và không hết giờ.",
  },
  {
    id: "streak",
    name: "Người giữ nhịp",
    mark: "N",
    tone: "orange",
    criteria: "Chuỗi lượt trả lời đúng liên tiếp dài nhất. Cần ít nhất 3 lượt.",
  },
  {
    id: "bigTree",
    name: "Cây đại thụ",
    mark: "C",
    tone: "green",
    criteria: "Đã dùng ít nhất một từ 5 âm tiết trong chế độ Nối từ.",
  },
];

function createPlayerStats() {
  return {
    words: 0,
    syllables: 0,
    knownWords: 0,
    creativeWords: 0,
    answerMsTotal: 0,
    timedAnswers: 0,
    timeouts: 0,
    mistakes: 0,
    streak: 0,
    bestStreak: 0,
    longWords: 0,
  };
}

function secondsLabel(ms) {
  return (ms / 1000).toFixed(1).replace(".", ",");
}

function firstLetterOf(value) {
  const chars = Array.from(String(value ?? "").normalize("NFC"));
  return chars.length ? chars[0].toLowerCase() : "";
}

function buildInitialWeights(syllables) {
  const weights = new Map();
  for (const syllable of syllables) {
    const letter = firstLetterOf(syllable);
    if (!letter) continue;
    weights.set(letter, (weights.get(letter) || 0) + 1);
  }
  return weights;
}

function letterLabel(letter) {
  return String(letter ?? "").toLocaleUpperCase("vi");
}

const FUNCTION_WORDS = new Set([
  "a", "à", "á", "ạ", "ơi", "ừ", "vâng", "dạ", "và", "với", "của", "cho", "để", "là", "có",
  "không", "chẳng", "chưa", "đã", "đang", "sẽ", "vẫn", "còn", "cũng", "rất", "quá", "lắm",
  "nhé", "nhá", "nha", "này", "đó", "kia", "ấy", "nào", "gì", "ai", "sao", "thế", "thì", "mà",
  "nên", "nhưng", "hoặc", "vì", "nếu", "khi", "trong", "ngoài", "trên", "dưới", "giữa", "bằng",
  "bởi", "do", "tại", "từ", "đến", "về", "hơn", "nhất", "một", "hai", "ba", "bốn", "năm", "sáu",
  "bảy", "tám", "chín", "mười", "các", "những", "mọi", "mỗi", "cả", "tất", "rồi", "nhỉ", "đấy",
  "thôi", "chứ", "hả", "hử", "vậy", "được", "bị", "bởi vì", "cho nên", "như", "sung",
]);

/**
 * Chuẩn hoá câu trả lời: NFC, chữ thường, bỏ dấu câu, gộp khoảng trắng.
 * Giữ nguyên dấu gạch nối và chữ số để bị từ chối ở bước kiểm tra âm tiết.
 */
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[’'`´]/g, " ")
    .replace(/[.,!?;:"“”‘’()[\]{}…]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitSyllables(normalized) {
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

/**
 * Kiểm tra một câu trả lời theo luật nối từ hoặc luật đôi chữ cái.
 */
export function validateAnswer(
  text,
  {
    dictionary,
    used,
    requiredSyllable,
    mode = DEFAULT_MODE,
    gameMode = GAME_MODE_CHAIN,
    pair = null,
  }
) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return { ok: false, reason: "Hãy nhập từ của bạn." };
  }

  if (normalized.length > 64) {
    return { ok: false, reason: "Từ quá dài. Tối đa 5 âm tiết." };
  }

  const syllables = splitSyllables(normalized);

  if (gameMode === GAME_MODE_LETTERS) {
    if (!Array.isArray(pair) || pair.length !== 2) {
      return { ok: false, reason: "Chưa có cặp chữ cái cho lượt này." };
    }

    const pairLetters = pair.map((letter) =>
      String(letter ?? "").normalize("NFC").trim().toLowerCase()
    );

    if (syllables.length !== 2) {
      return { ok: false, reason: "Chế độ Đôi chữ cái cần đúng 2 âm tiết." };
    }

    for (let index = 0; index < 2; index += 1) {
      if (pairLetters[index].length !== 1 || firstLetterOf(syllables[index]) !== pairLetters[index]) {
        return {
          ok: false,
          reason: `Âm tiết thứ ${index + 1} phải bắt đầu bằng “${letterLabel(pairLetters[index])}”.`,
        };
      }
    }
  } else {
    if (syllables.length < MIN_SYLLABLES || syllables.length > MAX_SYLLABLES) {
      return { ok: false, reason: `Từ cần có từ ${MIN_SYLLABLES} đến ${MAX_SYLLABLES} âm tiết.` };
    }

    if (requiredSyllable && syllables[0] !== requiredSyllable) {
      return {
        ok: false,
        reason: `Từ mới phải bắt đầu bằng “${requiredSyllable}”.`,
        requiredSyllable,
      };
    }
  }

  for (const syllable of syllables) {
    if (!dictionary.syllables.has(syllable)) {
      return { ok: false, reason: `Từ chứa âm tiết “${syllable}” không có trong từ điển tiếng Việt.` };
    }
  }

  const known = dictionary.words.has(normalized);

  if (mode === "strict" && !known) {
    return {
      ok: false,
      reason: "Chế độ Khắt khe: nguyên cụm từ này chưa có trong từ điển.",
    };
  }

  if (!known && syllables.every((syllable) => FUNCTION_WORDS.has(syllable))) {
    return { ok: false, reason: "Cụm này chưa tạo thành từ có nghĩa." };
  }

  if (used.has(normalized)) {
    return { ok: false, reason: `“${normalized}” đã được dùng rồi.` };
  }

  return { ok: true, normalized, syllables, known, score: 1 };
}

export function sanitizeName(value, fallback = "Người chơi") {
  const name = String(value ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(name);
  if (!chars.length) return fallback;
  return chars.slice(0, 20).join("");
}

export function initialsOf(name) {
  const parts = sanitizeName(name, "?").split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (Array.from(parts[0])[0] + Array.from(parts[parts.length - 1])[0]).toUpperCase();
  }
  return Array.from(parts[0] || "?").slice(0, 2).join("").toUpperCase();
}

export function hueOf(value) {
  let hash = 0;
  const str = String(value ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function computeTitles(
  players,
  { gameMode = GAME_MODE_CHAIN, mode = DEFAULT_MODE, winnerIds = null } = {}
) {
  const roster = Array.isArray(players) ? players.filter(Boolean) : [];
  if (!roster.length) return [];

  const forcedWinners = Array.isArray(winnerIds)
    ? [...new Set(winnerIds.filter(Boolean))]
    : [];
  const kingCandidates = forcedWinners.length
    ? roster.filter((player) => forcedWinners.includes(player.id))
    : roster;

  const stat = (player, key) => Number(player.stats?.[key] || 0);
  const awards = [];
  const add = (id, playerIds, detail) => {
    const ids = [...new Set(playerIds.filter(Boolean))];
    if (ids.length) awards.push({ id, playerIds: ids, detail });
  };
  const leaders = (candidates, valueOf) => {
    if (!candidates.length) return { ids: [], best: 0 };
    const best = Math.max(...candidates.map(valueOf));
    if (!Number.isFinite(best)) return { ids: [], best: 0 };
    return {
      ids: candidates.filter((player) => valueOf(player) === best).map((player) => player.id),
      best,
    };
  };

  const topScore = Math.max(
    ...kingCandidates.map((player) => Number(player.score) || 0)
  );
  if (topScore > 0 || forcedWinners.length) {
    add(
      "king",
      kingCandidates
        .filter((player) => (Number(player.score) || 0) === topScore)
        .map((player) => player.id),
      topScore > 0 ? `${topScore} điểm` : "Thắng ván"
    );
  }

  const syllableLeaders = leaders(
    roster.filter((player) => stat(player, "syllables") >= 6),
    (player) => stat(player, "syllables")
  );
  add(
    "syllableMaster",
    syllableLeaders.ids,
    `${syllableLeaders.best} âm tiết`
  );

  const lightningCandidates = roster.filter(
    (player) => stat(player, "timedAnswers") >= 2
  );
  if (lightningCandidates.length) {
    const average = (player) =>
      stat(player, "answerMsTotal") / stat(player, "timedAnswers");
    const best = Math.min(...lightningCandidates.map(average));
    add(
      "lightning",
      lightningCandidates
        .filter((player) => Math.abs(average(player) - best) < 1)
        .map((player) => player.id),
      `${secondsLabel(best)} giây/câu`
    );
  }

  if (mode === "smart") {
    const creativeLeaders = leaders(
      roster.filter((player) => stat(player, "creativeWords") >= 2),
      (player) => stat(player, "creativeWords")
    );
    add(
      "creator",
      creativeLeaders.ids,
      `${creativeLeaders.best} từ sáng tạo`
    );
  }

  const flawless = roster.filter(
    (player) =>
      stat(player, "words") >= 3 &&
      stat(player, "mistakes") === 0 &&
      stat(player, "timeouts") === 0
  );
  add(
    "flawless",
    flawless.map((player) => player.id),
    "Không sai · không hết giờ"
  );

  const streakLeaders = leaders(
    roster.filter((player) => stat(player, "bestStreak") >= 3),
    (player) => stat(player, "bestStreak")
  );
  add("streak", streakLeaders.ids, `${streakLeaders.best} lượt liên tiếp`);

  if (gameMode !== GAME_MODE_LETTERS) {
    add(
      "bigTree",
      roster
        .filter((player) => stat(player, "longWords") >= 1)
        .map((player) => player.id),
      "Đã dùng từ 5 âm tiết"
    );
  }

  return awards;
}

export class GameHost {
  constructor({
    code,
    hostName,
    hostPeerId = null,
    dictionary,
    imageQuestions = [],
    onImageSeen = () => {},
    imageSeenIds = [],
    mode = DEFAULT_MODE,
    gameMode = GAME_MODE_CHAIN,
    pairMode = PAIR_MODE_RANDOM,
    turnSeconds = TURN_SECONDS,
    onChange = () => {},
  }) {
    if (!dictionary || !(dictionary.words instanceof Set) || !(dictionary.syllables instanceof Set)) {
      throw new Error("Thiếu từ điển để kiểm tra từ.");
    }

    this.code = code;
    this.dictionary = dictionary;
    this.imageQuestionPacks = Array.isArray(imageQuestions) ? { idiom: imageQuestions, object: [] } : imageQuestions;
    this.imageSeenHistory = Array.isArray(imageSeenIds) ? { idiom: imageSeenIds, object: [] } : imageSeenIds;
    this.onImageSeen = onImageSeen;
    this.imageQuizMode = IMAGE_QUIZ_IDIOM;
    this.imageQuiz = this._makeImageQuiz(this.imageQuizMode);
    this.quizTransitionTimer = null;
    this.mode = mode === "strict" ? "strict" : "smart";
    this.gameMode = gameMode === GAME_MODE_LETTERS ? GAME_MODE_LETTERS : GAME_MODE_CHAIN;
    this.pairMode = pairMode === PAIR_MODE_MANUAL ? PAIR_MODE_MANUAL : PAIR_MODE_RANDOM;
    this.turnSeconds = Math.min(120, Math.max(15, Number(turnSeconds) || TURN_SECONDS));
    this.wordTurnSeconds = this.turnSeconds;
    this.onChange = typeof onChange === "function" ? onChange : () => {};
    this.initialWeights = buildInitialWeights(dictionary.syllables);
    this.twoSyllableWords = null;
    this.availablePairs = null;

    this.phase = "lobby";
    this.players = [];
    this.order = [];
    this.playerSeq = 0;
    this.historySeq = 0;
    this.history = [];
    this.used = new Set();
    this.requiredSyllable = null;
    this.pair = null;
    this.awaitingPair = false;
    this.winnerOverride = null;
    this.turnPlayerId = null;
    this.turnIndex = -1;
    this.turnSeq = 0;
    this.turnDeadline = 0;
    this.timer = null;

    this.eventSeq = 0;
    this.lastEvent = null;
    this.hostPlayerId = null;

    this.addPlayer({ name: hostName, peerId: hostPeerId, isHost: true, silent: true });
  }

  addPlayer({ name, peerId = null, isHost = false, silent = false }) {
    if (this.players.length >= MAX_PLAYERS) {
      throw new Error(`Phòng đã đủ ${MAX_PLAYERS} người.`);
    }

    const player = {
      id: `p${++this.playerSeq}`,
      name: sanitizeName(name, `Người chơi ${this.players.length + 1}`),
      peerId,
      isHost: Boolean(isHost),
      score: 0,
      online: true,
      joinedAt: Date.now(),
      stats: createPlayerStats(),
    };

    if (player.isHost) this.hostPlayerId = player.id;
    this.players.push(player);

    if (this.phase === "playing") {
      this.order.push(player.id);
    }

    if (!silent) {
      this._event("join", `${player.name} đã vào phòng.`);
      this.onChange();
    }

    return player;
  }

  removePlayer(playerId) {
    const index = this.players.findIndex((player) => player.id === playerId);
    if (index === -1) return false;

    const player = this.players[index];

    if (this.phase === "playing") {
      if (!player.online) return false;
      player.online = false;
      this._event("leave", `${player.name} đã mất kết nối.`);
      if (this.turnPlayerId === playerId) {
        this._advanceTurn();
      }
    } else {
      this.players.splice(index, 1);
      this.order = this.order.filter((id) => id !== playerId);
      this._event("leave", `${player.name} đã rời phòng.`);
    }

    this.onChange();
    return true;
  }

  setMode(mode) {
    const next = mode === "strict" ? "strict" : "smart";
    if (this.mode === next) return;
    this.mode = next;
    this._event("mode", next === "strict" ? "Đã bật kiểm tra Khắt khe." : "Đã bật kiểm tra Thông minh.");
    this.onChange();
  }

  setGameMode(gameMode) {
    if (this.phase !== "lobby") {
      throw new Error("Chỉ đổi kiểu chơi khi đang ở phòng chờ.");
    }
    const next = [GAME_MODE_LETTERS, GAME_MODE_IMAGE].includes(gameMode) ? gameMode : GAME_MODE_CHAIN;
    if (this.gameMode === next) return;
    this.gameMode = next;
    this._event(
      "mode",
      next === GAME_MODE_LETTERS ? "Đã chọn chế độ Đôi chữ cái." : next === GAME_MODE_IMAGE ? "Đã chọn Nhìn hình đoán chữ." : "Đã chọn chế độ Nối từ."
    );
    this.onChange();
  }

  _makeImageQuiz(mode) {
    return new ImageQuizRound({
      questions: this.imageQuestionPacks?.[mode] || [],
      seenIds: this.imageSeenHistory?.[mode] || [],
      onSeen: (id, answerKey) => this.onImageSeen(mode, id, answerKey),
    });
  }

  setImageQuizMode(mode) {
    if (this.phase !== "lobby") throw new Error("Chỉ được chọn kiểu câu hỏi trong phòng chờ.");
    if (this.gameMode !== GAME_MODE_IMAGE) throw new Error("Vui lòng chọn trò Nhìn hình đoán chữ.");
    if (![IMAGE_QUIZ_IDIOM, IMAGE_QUIZ_OBJECT].includes(mode)) throw new Error("Kiểu câu hỏi không hợp lệ.");
    if (this.imageQuizMode === mode) return;
    this.imageQuizMode = mode;
    this.imageQuiz = this._makeImageQuiz(mode);
    this._event("mode", mode === IMAGE_QUIZ_OBJECT ? "Đã chọn Đoán vật thể ảnh khó." : "Đã chọn Thành ngữ / tục ngữ.");
    this.onChange();
  }

  setPairMode(pairMode) {
    if (this.phase !== "lobby") {
      throw new Error("Chỉ đổi cách chọn cặp chữ khi đang ở phòng chờ.");
    }
    if (this.gameMode !== GAME_MODE_LETTERS) {
      throw new Error("Cách chọn cặp chữ chỉ dùng trong chế độ Đôi chữ cái.");
    }
    const next = pairMode === PAIR_MODE_MANUAL ? PAIR_MODE_MANUAL : PAIR_MODE_RANDOM;
    if (this.pairMode === next) return;
    this.pairMode = next;
    this._event(
      "mode",
      next === PAIR_MODE_MANUAL
        ? "Chủ phòng sẽ chọn một cặp chữ cho cả ván."
        : "Hệ thống sẽ chọn một cặp chữ cho cả ván."
    );
    this.onChange();
  }

  start(byPlayerId) {
    this._assertHost(byPlayerId);
    if (this.phase === "playing") throw new Error("Ván đấu đã bắt đầu rồi.");

    const online = this.players.filter((player) => player.online);
    if (online.length < 2) throw new Error("Cần ít nhất 2 người để bắt đầu.");

    if (this.gameMode === GAME_MODE_IMAGE && !this.imageQuiz.start()) {
      throw new Error("Không còn câu hỏi mới trong chế độ này trên thiết bị chủ phòng. Hãy bổ sung ngân hàng câu hỏi.");
    }
    for (const player of this.players) player.score = 0;

    this.players = online;
    this._resetPlayerStats();
    this.order = online.map((player) => player.id);
    this.history = [];
    this.used.clear();
    this.requiredSyllable = null;
    this.pair = null;
    this.awaitingPair = false;
    this.winnerOverride = null;
    this.phase = "playing";
    this._clearQuizTransition();
    if (this.gameMode === GAME_MODE_IMAGE) {
      this.turnIndex = -1;
      this.turnPlayerId = null;
      this.turnSeconds = IMAGE_QUIZ_SECONDS;
      this.turnSeq += 1;
      this._startTimer();
    } else {
      this.turnSeconds = this.wordTurnSeconds;
      this.turnIndex = Math.floor(Math.random() * this.order.length);
      this._setTurn({ initial: true });
    }
    this._event(
      "start",
      this.gameMode === GAME_MODE_LETTERS
        ? this.pairMode === PAIR_MODE_MANUAL
          ? "Ván mới bắt đầu! Chờ chủ phòng chọn cặp chữ cái cho cả ván."
          : "Ván mới bắt đầu! Cặp chữ cái đã được chọn cho cả ván."
        : this.gameMode === GAME_MODE_IMAGE
          ? "Đố hình bắt đầu! Cứ chơi liên tục cho đến khi chủ phòng kết thúc."
          : "Ván mới bắt đầu! Người đầu tiên có thể chọn từ bất kỳ."
    );
    this.onChange();
  }

  submit(playerId, text) {
    if (this.phase !== "playing") {
      return { ok: false, reason: "Ván đấu chưa bắt đầu." };
    }

    if (this.gameMode === GAME_MODE_IMAGE) {
      const player = this.players.find((p) => p.id === playerId && p.online);
      if (!player) return { ok: false, reason: "Người chơi không còn trong phòng." };
      const result = this.imageQuiz.guess(playerId, text, Date.now(), this.turnDeadline, this.turnSeconds * 1000);
      if (result.ok) {
        player.score += result.score;
        this._event("guess", `${player.name} đoán đúng! +${result.score} điểm.`);
        if (this.imageQuiz.allAnswered(this.players.filter((p) => p.online).map((p) => p.id))) {
          this._revealImageRound();
        }
        this.onChange();
      }
      return result;
    }
    if (this.gameMode === GAME_MODE_LETTERS && (this.awaitingPair || !this.pair)) {
      return { ok: false, reason: "Chờ chủ phòng chọn cặp chữ cái." };
    }

    if (playerId !== this.turnPlayerId) {
      return { ok: false, reason: "Chưa đến lượt của bạn." };
    }

    const player = this._currentPlayer();
    if (!player || !player.online) {
      return { ok: false, reason: "Người chơi không còn trong phòng." };
    }

    const result = validateAnswer(text, {
      dictionary: this.dictionary,
      used: this.used,
      requiredSyllable: this.requiredSyllable,
      mode: this.mode,
      gameMode: this.gameMode,
      pair: this.pair,
    });

    if (!result.ok) {
      player.stats.mistakes += 1;
      player.stats.streak = 0;
      return result;
    }

    const now = Date.now();
    const elapsedMs = this.turnDeadline
      ? Math.min(
          this.turnSeconds * 1000,
          Math.max(1, now - (this.turnDeadline - this.turnSeconds * 1000))
        )
      : 0;

    player.stats.words += 1;
    player.stats.syllables += result.syllables.length;
    if (result.known) player.stats.knownWords += 1;
    else player.stats.creativeWords += 1;
    if (result.syllables.length >= MAX_SYLLABLES) player.stats.longWords += 1;
    player.stats.timedAnswers += 1;
    player.stats.answerMsTotal += elapsedMs;
    player.stats.streak += 1;
    player.stats.bestStreak = Math.max(player.stats.bestStreak, player.stats.streak);

    this.used.add(result.normalized);
    player.score += result.score;
    this.history.push({
      id: ++this.historySeq,
      n: this.history.length + 1,
      playerId: player.id,
      playerName: player.name,
      phrase: result.normalized,
      syllables: result.syllables,
      known: result.known,
      pair: this.pair ? [...this.pair] : null,
      elapsedMs,
      at: now,
    });
    if (this.history.length > 200) this.history.shift();

    this.requiredSyllable =
      this.gameMode === GAME_MODE_CHAIN
        ? result.syllables[result.syllables.length - 1]
        : null;
    this._advanceTurn();
    this.onChange();

    return { ...result, playerName: player.name };
  }

  end(byPlayerId) {
    this._assertHost(byPlayerId);
    if (this.phase !== "playing") return;
    this.winnerOverride = null;
    this.phase = "ended";
    this._clearTimer();
    this._clearQuizTransition();
    this._event("end", "Ván đấu đã kết thúc.");
    this.onChange();
  }

  restart(byPlayerId) {
    this._assertHost(byPlayerId);
    const online = this.players.filter((player) => player.online);
    if (online.length < 2) throw new Error("Cần ít nhất 2 người để chơi lại.");

    if (this.gameMode === GAME_MODE_IMAGE && !this.imageQuiz.start()) {
      throw new Error("Không còn câu hỏi mới để chơi lại. Vui lòng bổ sung dữ liệu trước.");
    }
    this.players = online;
    for (const player of this.players) player.score = 0;
    this._resetPlayerStats();
    this.order = this.players.map((player) => player.id);
    this.history = [];
    this.used.clear();
    this.requiredSyllable = null;
    this.pair = null;
    this.awaitingPair = false;
    this.winnerOverride = null;
    this.phase = "playing";
    this._clearQuizTransition();
    if (this.gameMode === GAME_MODE_IMAGE) {
      this.turnIndex = -1;
      this.turnPlayerId = null;
      this.turnSeconds = IMAGE_QUIZ_SECONDS;
      this.turnSeq += 1;
      this._startTimer();
    } else {
      this.turnSeconds = this.wordTurnSeconds;
      this.turnIndex = Math.floor(Math.random() * this.order.length);
      this._setTurn({ initial: true });
    }
    this._event("restart", "Chơi lại nào! Điểm số đã được đặt lại.");
    this.onChange();
  }

  backToLobby(byPlayerId) {
    this._assertHost(byPlayerId);
    this._clearTimer();
    this._clearQuizTransition();
    this.players = this.players.filter((player) => player.online);
    for (const player of this.players) player.score = 0;
    this._resetPlayerStats();
    this.order = [];
    this.history = [];
    this.used.clear();
    this.requiredSyllable = null;
    this.pair = null;
    this.awaitingPair = false;
    this.winnerOverride = null;
    this.turnPlayerId = null;
    this.turnIndex = -1;
    this.turnDeadline = 0;
    this.phase = "lobby";
    this._event("lobby", "Đã trở về phòng chờ.");
    this.onChange();
  }

  setPair(byPlayerId, first, second) {
    this._assertHost(byPlayerId);
    if (this.phase !== "playing") throw new Error("Ván đấu chưa bắt đầu.");
    if (this.gameMode !== GAME_MODE_LETTERS) {
      throw new Error("Chỉ dùng cặp chữ cái trong chế độ Đôi chữ cái.");
    }
    if (this.pairMode !== PAIR_MODE_MANUAL) {
      throw new Error("Hệ thống đang tự chọn cặp chữ.");
    }
    if (!this.awaitingPair) throw new Error("Cặp chữ đã được chọn cho cả ván.");

    const firstLetter = this._pairLetter(first, 1);
    const secondLetter = this._pairLetter(second, 2);
    this._pairCatalog();
    if (!this.availablePairs.has(`${firstLetter}|${secondLetter}`)) {
      throw new Error(
        `Cặp “${letterLabel(firstLetter)} · ${letterLabel(secondLetter)}” chưa có từ 2 âm tiết nào trong từ điển.`
      );
    }
    this.pair = [firstLetter, secondLetter];
    this.awaitingPair = false;
    this._startTimer();
    this._event("pair", `Cặp chữ cái cho cả ván: ${this._pairLabel()}.`);
    this.onChange();
    return [...this.pair];
  }

  randomizePair(byPlayerId) {
    this._assertHost(byPlayerId);
    if (this.phase !== "playing") throw new Error("Ván đấu chưa bắt đầu.");
    if (this.gameMode !== GAME_MODE_LETTERS) {
      throw new Error("Chỉ dùng cặp chữ cái trong chế độ Đôi chữ cái.");
    }
    if (this.pairMode !== PAIR_MODE_MANUAL) {
      throw new Error("Hệ thống đang tự chọn cặp chữ.");
    }
    if (!this.awaitingPair) throw new Error("Cặp chữ đã được chọn cho cả ván.");

    this.pair = this._randomPair();
    this.awaitingPair = false;
    this._startTimer();
    this._event("pair", `Cặp chữ cái cho cả ván: ${this._pairLabel()}.`);
    this.onChange();
    return [...this.pair];
  }

  destroy() {
    this._clearTimer();
    this._clearQuizTransition();
    this.onChange = () => {};
  }

  publicState() {
    const now = Date.now();
    const winners = this.phase === "ended" ? this._winnerIds() : [];
    const titles =
      this.phase === "ended"
        ? computeTitles(this.players, {
            gameMode: this.gameMode,
            mode: this.mode,
            winnerIds: winners,
          })
        : [];
    const titleIdsByPlayer = new Map();
    for (const award of titles) {
      for (const playerId of award.playerIds) {
        if (!titleIdsByPlayer.has(playerId)) titleIdsByPlayer.set(playerId, []);
        titleIdsByPlayer.get(playerId).push(award.id);
      }
    }

    return {
      code: this.code,
      phase: this.phase,
      mode: this.mode,
      gameMode: this.gameMode,
      pairMode: this.pairMode,
      imageQuizMode: this.imageQuizMode,
      imageQuizAvailable: this.gameMode === GAME_MODE_IMAGE && this.phase === "lobby" ? this.imageQuiz.remainingCount() : null,
      imageQuiz: this.gameMode === GAME_MODE_IMAGE && this.phase !== "lobby" ? this.imageQuiz.publicState() : null,
      hostId: this.hostPlayerId,
      players: this.players.map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        online: player.online,
        isHost: player.isHost,
        titleIds: titleIdsByPlayer.get(player.id) || [],
      })),
      order: [...this.order],
      turnPlayerId: this.turnPlayerId,
      turnSeq: this.turnSeq,
      requiredSyllable: this.requiredSyllable,
      pair: this.pair ? [...this.pair] : null,
      awaitingPair: this.awaitingPair,
      turnSeconds: this.turnSeconds,
      remainingMs: this.phase === "playing" ? Math.max(0, this.turnDeadline - now) : 0,
      history: this.history.slice(-60),
      usedCount: this.used.size,
      winners,
      titles,
      lastEvent: this.lastEvent,
    };
  }

  _winnerIds() {
    if (this.phase === "ended" && this.winnerOverride?.length) {
      return [...this.winnerOverride];
    }
    if (!this.players.length) return [];
    const top = Math.max(...this.players.map((player) => player.score));
    if (top <= 0) return [];
    return this.players.filter((player) => player.score === top).map((player) => player.id);
  }

  _assertHost(playerId) {
    if (!this.hostPlayerId || playerId !== this.hostPlayerId) {
      throw new Error("Chỉ chủ phòng mới có thể thực hiện thao tác này.");
    }
  }

  _resetPlayerStats() {
    for (const player of this.players) player.stats = createPlayerStats();
  }

  _pairLetter(value, position) {
    const raw = String(value ?? "").normalize("NFC").trim();
    const chars = Array.from(raw);
    if (chars.length !== 1 || !/^\p{L}$/u.test(chars[0])) {
      throw new Error(`Chữ thứ ${position} phải là một chữ cái.`);
    }
    const letter = chars[0].toLowerCase();
    if (!this.initialWeights.has(letter)) {
      throw new Error(`Không có từ tiếng Việt nào bắt đầu bằng “${letterLabel(letter)}”.`);
    }
    return letter;
  }

  _pairLabel() {
    return this.pair ? this.pair.map((letter) => letterLabel(letter)).join(" · ") : "";
  }

  _pairCatalog() {
    if (this.twoSyllableWords) return;
    this.twoSyllableWords = [];
    this.availablePairs = new Set();
    for (const word of this.dictionary.words) {
      const syllables = word.split(" ");
      if (syllables.length !== 2) continue;
      this.twoSyllableWords.push(syllables);
      this.availablePairs.add(`${firstLetterOf(syllables[0])}|${firstLetterOf(syllables[1])}`);
    }
  }

  _randomPair() {
    this._pairCatalog();

    if (this.twoSyllableWords.length) {
      const syllables =
        this.twoSyllableWords[Math.floor(Math.random() * this.twoSyllableWords.length)];
      return [firstLetterOf(syllables[0]), firstLetterOf(syllables[1])];
    }

    const entries = [...this.initialWeights.entries()];
    if (!entries.length) return ["a", "a"];

    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    const pick = () => {
      let roll = Math.random() * total;
      for (const [letter, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return letter;
      }
      return entries[entries.length - 1][0];
    };

    return [pick(), pick()];
  }

  _event(type, message) {
    this.lastEvent = {
      id: ++this.eventSeq,
      type,
      message,
      at: Date.now(),
    };
    return this.lastEvent;
  }

  _currentPlayer() {
    return this.players.find((player) => player.id === this.turnPlayerId) || null;
  }

  _setTurn({ initial = false } = {}) {
    this.turnPlayerId = this.order[this.turnIndex] || null;
    this.turnSeq += 1;

    if (this.gameMode === GAME_MODE_LETTERS) {
      if (initial) {
        if (this.pairMode === PAIR_MODE_MANUAL) {
          this.pair = null;
          this.awaitingPair = true;
          this.turnDeadline = 0;
          this._clearTimer();
          return;
        }
        this.pair = this._randomPair();
      }

      if (!this.pair) {
        this.awaitingPair = true;
        this.turnDeadline = 0;
        this._clearTimer();
        return;
      }

      this.awaitingPair = false;
      this._startTimer();
      return;
    }

    this.pair = null;
    this.awaitingPair = false;
    this._startTimer();
  }

  _advanceTurn() {
    if (!this.order.length) {
      this.turnPlayerId = null;
      this.pair = null;
      this.awaitingPair = false;
      this.turnDeadline = 0;
      this._clearTimer();
      return;
    }

    const current = this.turnIndex;
    for (let step = 1; step <= this.order.length; step += 1) {
      const next = (current + step) % this.order.length;
      const player = this.players.find((item) => item.id === this.order[next]);
      if (player && player.online) {
        this.turnIndex = next;
        this.turnPlayerId = player.id;
        this._setTurn();
        return;
      }
    }

    this.turnPlayerId = null;
    this.pair = null;
    this.awaitingPair = false;
    this.turnDeadline = 0;
    this._clearTimer();
  }

  _startTimer() {
    this._clearTimer();
    if (this.phase !== "playing") return;
    this.turnDeadline = Date.now() + this.turnSeconds * 1000;
    this.timer = setTimeout(() => this._onTimeout(), this.turnSeconds * 1000 + 50);
  }

  _clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  _clearQuizTransition() {
    if (this.quizTransitionTimer) clearTimeout(this.quizTransitionTimer);
    this.quizTransitionTimer = null;
  }

  _revealImageRound() {
    if (this.phase !== "playing" || this.gameMode !== GAME_MODE_IMAGE || this.imageQuiz.revealed) return;
    this._clearTimer();
    this.imageQuiz.reveal();
    this.turnDeadline = 0;
    const first = this.players.find((p) => p.id === this.imageQuiz.firstWinnerId);
    this.history.push({
      id: ++this.historySeq,
      n: this.history.length + 1,
      phrase: this.imageQuiz.current.answer,
      syllables: [],
      playerId: first?.id || null,
      playerName: first ? first.name + " đoán nhanh nhất" : "Chưa ai đoán đúng",
    });
    this._event("reveal", "Đáp án: " + this.imageQuiz.current.answer);
    this.onChange();
    this._clearQuizTransition();
    this.quizTransitionTimer = setTimeout(() => {
      this.quizTransitionTimer = null;
      if (this.phase !== "playing" || this.gameMode !== GAME_MODE_IMAGE) return;
      const hasNext = this.imageQuiz.next();
      this.turnSeq += 1;
      if (hasNext) {
        this._startTimer();
        this._event("next", "Câu đố tiếp theo đã bắt đầu!");
      } else {
        this.turnDeadline = 0;
        this._event("exhausted", "Đã hết toàn bộ câu hỏi CHƯA TỪNG CHƠI. Trò chơi tạm dừng, chủ phòng có thể kết thúc và bổ sung dữ liệu.");
      }
      this.onChange();
    }, IMAGE_QUIZ_REVEAL_MS);
  }

  _onTimeout() {
    if (this.phase !== "playing") return;
    if (this.gameMode === GAME_MODE_IMAGE) {
      this._revealImageRound();
      return;
    }
    const player = this._currentPlayer();
    if (player?.stats) {
      player.stats.timeouts += 1;
      player.stats.streak = 0;
    }

    const online = this.players.filter((item) => item.online);
    if (this.gameMode === GAME_MODE_LETTERS && online.length === 2) {
      const winner = online.find((item) => item.id !== player?.id);
      this.winnerOverride = winner ? [winner.id] : [];
      this.phase = "ended";
      this.turnDeadline = 0;
      this._clearTimer();
      this._event(
        "end",
        winner
          ? `Hết giờ! ${player ? player.name + " thua" : "Một người chơi hết giờ"}. ${winner.name} thắng ván!`
          : "Hết giờ! Ván đấu kết thúc."
      );
      this.onChange();
      return;
    }

    this._event("timeout", `Hết giờ! ${player ? player.name + " " : ""}đã mất lượt.`);
    this._advanceTurn();
    this.onChange();
  }
}
