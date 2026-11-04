// Pure rules for the photo/illustration guessing mini-game.
// No DOM, PeerJS or network access: this module can be tested in Node.
export const IMAGE_QUIZ_SECONDS = 40;
export const IMAGE_QUIZ_REVEAL_MS = 3200;
export const IMAGE_QUIZ_IDIOM = "idiom";
export const IMAGE_QUIZ_OBJECT = "object";

export function normalizeGuess(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function prepareQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = new Set();
  const result = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id || "").trim();
    const answer = String(item.answer || "").normalize("NFC").trim();
    const imageUrl = typeof item.imageUrl === "string" ? item.imageUrl.trim() : "";
    const emoji = typeof item.emoji === "string" ? item.emoji.trim() : "";
    // Scene panels are visual hints only, never the answer or an explanatory prompt.
    const scene = Array.isArray(item.scene)
      ? item.scene.filter((part) => typeof part === "string" && part.trim()).map((part) => part.trim().slice(0, 24)).slice(0, 3)
      : [];
    if (!id || !answer || (!emoji && !imageUrl && !scene.length) || ids.has(id)) continue;
    if (imageUrl && !/^https:\/\//.test(imageUrl) && !/^assets\/image-quiz\/[\w./-]+$/.test(imageUrl)) continue;
    const aliases = Array.isArray(item.aliases)
      ? item.aliases.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 12)
      : [];
    const keys = new Set([answer, ...aliases].map(normalizeGuess).filter(Boolean));
    if (!keys.size) continue;
    ids.add(id);
    result.push({
      id, answer, aliases, keys, imageUrl, emoji, scene,
      difficulty: ["hard", "medium"].includes(item.difficulty) ? item.difficulty : "medium",
      category: String(item.category || "Tổng hợp").slice(0, 48),
      sourceUrl: /^https:\/\//.test(item.sourceUrl || "") ? item.sourceUrl : "",
      attribution: String(item.attribution || "").slice(0, 180),
      license: String(item.license || "").slice(0, 80),
    });
  }
  return result;
}

// Never revisit an image OR a normalized answer until explicitly reset.
// An exhausted pool stays exhausted: the owner must provide new content.
export function chooseQuestions(questions, count = questions.length, seenIds = [], random = Math.random) {
  const seen = new Set(seenIds);
  const available = questions.filter((q) => !seen.has(q.id) && !seen.has("answer:" + normalizeGuess(q.answer)));
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.max(0, Math.min(i, Math.floor(random() * (i + 1))));
    [available[i], available[j]] = [available[j], available[i]];
  }
  const chosen = [];
  const seenAnswers = new Set();
  for (const q of available) {
    const key = normalizeGuess(q.answer);
    if (seenAnswers.has(key)) continue;
    seenAnswers.add(key);
    chosen.push(q);
    if (chosen.length >= count) break;
  }
  return chosen;
}

// Continuous play has no round cap, but a finite unique bank is finite.
// On exhaustion we PAUSE, never silently recycle previous answers.
export class ImageQuizRound {
  constructor({ questions = [], seenIds = [], onSeen = () => {} } = {}) {
    this.questions = prepareQuestions(questions);
    this.seenIds = new Set(seenIds);
    this.onSeen = onSeen;
    this.deck = [];
    this.index = -1;
    this.current = null;
    this.usedAnswers = new Set();
    this.revealed = false;
    this.answered = new Set();
    this.firstWinnerId = null;
    this.exhausted = false;
  }

  start() {
    if (!this.questions.length) throw new Error("Chế độ này chưa có câu hỏi hợp lệ.");
    this.deck = [];
    this.index = -1;
    this.current = null;
    this.usedAnswers.clear();
    this.revealed = false;
    this.exhausted = false;
    return this.next();
  }

  _refillDeck() {
    const seen = [...this.seenIds, ...[...this.usedAnswers].map((x) => "answer:" + x)];
    this.deck = chooseQuestions(this.questions, this.questions.length, seen);
  }

  remainingCount() {
    const seen = new Set([...this.seenIds, ...[...this.usedAnswers].map((x) => "answer:" + x)]);
    return chooseQuestions(this.questions, this.questions.length, seen, () => 0).length;
  }

  next() {
    if (!this.deck.length) this._refillDeck();
    const question = this.deck.shift();
    this.answered.clear();
    this.firstWinnerId = null;
    this.revealed = false;
    if (!question) {
      this.exhausted = true;
      this.current = null;
      return false;
    }
    this.exhausted = false;
    this.index += 1;
    this.current = question;
    this.usedAnswers.add(normalizeGuess(question.answer));
    const answerKey = "answer:" + normalizeGuess(question.answer);
    this.seenIds.add(question.id);
    this.seenIds.add(answerKey);
    this.onSeen(question.id, answerKey);
    return true;
  }

  guess(playerId, text, now, deadline, totalMs = IMAGE_QUIZ_SECONDS * 1000) {
    if (!this.current || this.revealed || now >= deadline) {
      return { ok: false, reason: "Câu hỏi đã hết giờ." };
    }
    if (this.answered.has(playerId)) {
      return { ok: false, reason: "Bạn đã trả lời đúng câu này rồi." };
    }
    const key = normalizeGuess(text);
    if (!key) return { ok: false, reason: "Hãy nhập đáp án của bạn." };
    if (key.length > 80) return { ok: false, reason: "Đáp án quá dài." };
    if (!this.current.keys.has(key)) {
      return { ok: false, reason: "Chưa chính xác! Thử giải ý của cả bức tranh nhé." };
    }
    this.answered.add(playerId);
    const first = !this.firstWinnerId;
    if (first) this.firstWinnerId = playerId;
    const left = Math.max(0, Math.min(totalMs, deadline - now));
    const score = Math.max(20, Math.ceil((20 + (80 * left) / totalMs) / 10) * 10) + (first ? 20 : 0);
    return { ok: true, score, first };
  }

  allAnswered(onlinePlayerIds) {
    return onlinePlayerIds.length > 0 && onlinePlayerIds.every((id) => this.answered.has(id));
  }

  reveal() {
    this.revealed = true;
  }

  publicState() {
    if (!this.current) return { exhausted: true, round: Math.max(0, this.index + 1), answeredIds: [], revealed: false, answer: null, remaining: 0 };
    return {
      exhausted: false,
      remaining: this.remainingCount(),
      id: this.current.id,
      imageUrl: this.current.imageUrl,
      emoji: this.current.emoji,
      scene: [...this.current.scene],
      category: this.current.category,
      difficulty: this.current.difficulty,
      sourceUrl: this.current.sourceUrl,
      attribution: this.current.attribution,
      license: this.current.license,
      round: this.index + 1,
      answeredIds: [...this.answered],
      revealed: this.revealed,
      answer: this.revealed ? this.current.answer : null,
      firstWinnerId: this.firstWinnerId,
    };
  }
}
