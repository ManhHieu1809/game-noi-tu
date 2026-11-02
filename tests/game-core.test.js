import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  GameHost,
  MAX_PLAYERS,
  TITLE_RULES,
  computeTitles,
  normalizeText,
  sanitizeName,
  validateAnswer,
} from "../js/game-core.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const dictionary = {
  words: new Set(fs.readFileSync(path.join(root, "../assets/words.txt"), "utf8").trim().split("\n")),
  syllables: new Set(
    fs.readFileSync(path.join(root, "../assets/syllables.txt"), "utf8").trim().split("\n")
  ),
};

function check(text, { used = new Set(), requiredSyllable = null, mode = "smart" } = {}) {
  return validateAnswer(text, { dictionary, used, requiredSyllable, mode });
}

function checkLetters(text, pair, { used = new Set(), mode = "smart" } = {}) {
  return validateAnswer(text, {
    dictionary,
    used,
    requiredSyllable: null,
    mode,
    gameMode: "letters",
    pair,
  });
}

function wordForPair(pair) {
  const firstLetter = (value) => Array.from(value)[0];
  return [...dictionary.words].find((word) => {
    const syllables = word.split(" ");
    return (
      syllables.length === 2 &&
      firstLetter(syllables[0]) === pair[0] &&
      firstLetter(syllables[1]) === pair[1]
    );
  });
}

function titlePlayer(id, name, score, stats = {}) {
  return {
    id,
    name,
    score,
    stats: {
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
      ...stats,
    },
  };
}

test("normalizeText chuẩn hoá chữ hoa, dấu câu và khoảng trắng", () => {
  assert.equal(normalizeText("  Bánh   MÌ!  "), "bánh mì");
  assert.equal(normalizeText("“Mèo” – con."), "mèo – con");
  assert.equal(normalizeText(null), "");
});

test("sanitizeName cắt khoảng trắng, ký tự điều khiển và giới hạn 20 ký tự", () => {
  assert.equal(sanitizeName("  Nguyễn   Văn A "), "Nguyễn Văn A");
  assert.equal(sanitizeName(""), "Người chơi");
  assert.equal(Array.from(sanitizeName("a".repeat(40))).length, 20);
});

test("chấp nhận cụm từ có trong từ điển ở cả hai chế độ", () => {
  for (const mode of ["smart", "strict"]) {
    const result = check("Bánh mì!", { mode });
    assert.equal(result.ok, true);
    assert.equal(result.normalized, "bánh mì");
    assert.equal(result.known, true);
    assert.equal(result.score, 1);
  }
});

test("chế độ thông minh chấp nhận cụm ghép từ các âm tiết hợp lệ", () => {
  const result = check("con mèo");
  assert.equal(result.ok, true);
  assert.equal(result.known, false);
});

test("chế độ khắt khe từ chối cụm không có nguyên cụm trong từ điển", () => {
  const result = check("con mèo", { mode: "strict" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Khắt khe/);
});

test("từ chứa âm tiết lạ bị từ chối", () => {
  const result = check("mèo zzz");
  assert.equal(result.ok, false);
  assert.match(result.reason, /zzz/);
});

test("cụm chỉ gồm hư từ bị từ chối", () => {
  const result = check("và của");
  assert.equal(result.ok, false);
  assert.match(result.reason, /chưa tạo thành từ/);
});

test("kiểm tra số lượng âm tiết", () => {
  assert.equal(check("mèo").ok, false);
  assert.equal(check("bánh mì bánh mì bánh mì").ok, false);
});

test("kiểm tra âm tiết bắt buộc phải nối đúng", () => {
  const wrong = check("bánh mì", { requiredSyllable: "mèo" });
  assert.equal(wrong.ok, false);
  assert.match(wrong.reason, /mèo/);

  const right = check("mì gói", { requiredSyllable: "mì" });
  assert.equal(right.ok, true);
});

test("từ đã dùng không được dùng lại", () => {
  const used = new Set(["bánh mì"]);
  const result = check("bánh mì", { used });
  assert.equal(result.ok, false);
  assert.match(result.reason, /đã được dùng/);
});

test("Đôi chữ cái: chấp nhận đúng 2 âm tiết khớp cặp chữ", () => {
  for (const answer of ["hoa hồng", "hoàng hôn"]) {
    const result = checkLetters(answer, ["h", "h"]);
    assert.equal(result.ok, true, answer);
    assert.equal(result.syllables.length, 2);
  }

  const uppercase = checkLetters("HOA HỒNG", ["H", "H"]);
  assert.equal(uppercase.ok, true);
  assert.equal(uppercase.normalized, "hoa hồng");
});

test("Đôi chữ cái: chế độ khắt khe vẫn yêu cầu nguyên cụm trong từ điển", () => {
  assert.equal(checkLetters("hoa hồng", ["h", "h"], { mode: "strict" }).ok, true);
  const result = checkLetters("hoa học", ["h", "h"], { mode: "strict" });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Khắt khe/);
});

test("Đôi chữ cái: từ chối sai số âm tiết hoặc sai chữ cái", () => {
  const length = checkLetters("hoa hồng đẹp", ["h", "h"]);
  assert.equal(length.ok, false);
  assert.match(length.reason, /đúng 2 âm tiết/);

  const first = checkLetters("hoa hồng", ["m", "h"]);
  assert.equal(first.ok, false);
  assert.match(first.reason, /Âm tiết thứ 1/);

  const second = checkLetters("hoa hồng", ["h", "s"]);
  assert.equal(second.ok, false);
  assert.match(second.reason, /Âm tiết thứ 2/);

  const missingPair = checkLetters("hoa hồng", null);
  assert.equal(missingPair.ok, false);
  assert.match(missingPair.reason, /cặp chữ cái/);
});

test("Đôi chữ cái: vẫn kiểm tra trùng từ, âm tiết lạ và hư từ", () => {
  const duplicate = checkLetters("hoa hồng", ["h", "h"], { used: new Set(["hoa hồng"]) });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.reason, /đã được dùng/);

  const unknown = checkLetters("hoa zzz", ["h", "z"]);
  assert.equal(unknown.ok, false);
  assert.match(unknown.reason, /zzz/);

  const functionWords = checkLetters("và của", ["v", "c"]);
  assert.equal(functionWords.ok, false);
  assert.match(functionWords.reason, /chưa tạo thành từ/);
});

test("Đôi chữ cái: chủ phòng chọn cặp cho cả ván và cũng được trả lời", (t) => {
  const game = new GameHost({
    code: "LET01",
    hostName: "An",
    dictionary,
    gameMode: "letters",
    pairMode: "manual",
    turnSeconds: 120,
  });
  t.after(() => game.destroy());
  game.addPlayer({ name: "Bình" });
  game.start("p1");

  let state = game.publicState();
  assert.equal(state.gameMode, "letters");
  assert.equal(state.awaitingPair, true);
  assert.equal(state.pair, null);
  assert.equal(state.remainingMs, 0);

  const currentId = state.turnPlayerId;
  game.turnIndex = game.order.indexOf("p1");
  game._setTurn();
  state = game.publicState();
  assert.equal(state.turnPlayerId, "p1");
  assert.equal(game.submit("p1", "hoa hồng").ok, false);
  assert.throws(() => game.setPair("p2", "h", "h"), /Chỉ chủ phòng/);
  game.setPair("p1", "H", "H");

  state = game.publicState();
  assert.deepEqual(state.pair, ["h", "h"]);
  assert.equal(state.awaitingPair, false);
  assert.ok(state.remainingMs > 0);

  const wrong = game.submit("p1", "hoa sen");
  assert.equal(wrong.ok, false);
  assert.match(wrong.reason, /Âm tiết thứ 2/);
  assert.equal(game.publicState().turnPlayerId, "p1");

  const right = game.submit("p1", "hoa hồng");
  assert.equal(right.ok, true);
  state = game.publicState();
  assert.equal(state.usedCount, 1);
  assert.equal(state.requiredSyllable, null);
  assert.equal(state.awaitingPair, false);
  assert.deepEqual(state.pair, ["h", "h"]);
  assert.equal(state.history[0].pair.join(" "), "h h");
  assert.equal(state.players.find((player) => player.id === "p1").score, 1);
  assert.notEqual(state.turnPlayerId, "p1");

  assert.throws(() => game.setPair("p1", "h", "h"), /cả ván/);
  assert.equal(game.submit(state.turnPlayerId, "học hành").ok, true);
  assert.equal(game.publicState().usedCount, 2);
  assert.equal(game.publicState().awaitingPair, false);
});

test("Đôi chữ cái: cặp chữ giữ nguyên qua các lượt", (t) => {
  const game = new GameHost({
    code: "LET02",
    hostName: "An",
    dictionary,
    gameMode: "letters",
    pairMode: "random",
    turnSeconds: 120,
  });
  t.after(() => game.destroy());
  game.addPlayer({ name: "Bình" });
  game.start("p1");

  let state = game.publicState();
  assert.equal(state.awaitingPair, false);
  assert.equal(state.pair.length, 2);
  assert.ok(state.remainingMs > 0);
  const initialPair = [...state.pair];

  const answer = wordForPair(state.pair);
  assert.ok(answer, `Phải có từ khớp cặp ${state.pair.join(" · ")}`);

  const firstSeq = state.turnSeq;
  const result = game.submit(state.turnPlayerId, answer);
  assert.equal(result.ok, true);

  state = game.publicState();
  assert.ok(state.turnSeq > firstSeq);
  assert.deepEqual(state.pair, initialPair);
  assert.equal(state.awaitingPair, false);
});

test("Đôi chữ cái: nút ngẫu nhiên dùng được khi chủ phòng chọn tự nhập", (t) => {
  const game = new GameHost({
    code: "LET03",
    hostName: "An",
    dictionary,
    gameMode: "letters",
    pairMode: "manual",
    turnSeconds: 120,
  });
  t.after(() => game.destroy());
  game.addPlayer({ name: "Bình" });
  game.start("p1");

  assert.throws(() => game.randomizePair("p2"), /Chỉ chủ phòng/);
  const pair = game.randomizePair("p1");
  assert.equal(pair.length, 2);
  assert.equal(game.publicState().awaitingPair, false);
  assert.ok(game.publicState().remainingMs > 0);
});

test("Đôi chữ cái 2 người: hết giờ tự kết thúc và người còn lại thắng", (t) => {
  const game = new GameHost({
    code: "LET05",
    hostName: "An",
    dictionary,
    gameMode: "letters",
    pairMode: "manual",
    turnSeconds: 120,
  });
  t.after(() => game.destroy());
  game.addPlayer({ name: "Bình" });
  game.start("p1");
  game.turnIndex = game.order.indexOf("p1");
  game._setTurn();
  game.setPair("p1", "h", "h");

  const host = game.players.find((player) => player.id === "p1");
  const guest = game.players.find((player) => player.id === "p2");
  host.score = 3;
  guest.score = 1;
  game._onTimeout();

  const state = game.publicState();
  assert.equal(state.phase, "ended");
  assert.deepEqual(state.winners, ["p2"]);
  assert.deepEqual(
    state.titles.find((award) => award.id === "king")?.playerIds,
    ["p2"]
  );
  assert.match(state.lastEvent.message, /Bình thắng ván/);
});

test("chỉ đổi kiểu chơi và cách chọn cặp khi ở phòng chờ", (t) => {
  const game = new GameHost({ code: "LET04", hostName: "An", dictionary, turnSeconds: 120 });
  t.after(() => game.destroy());
  game.addPlayer({ name: "Bình" });

  assert.throws(() => game.setPairMode("manual"), /Đôi chữ cái/);
  game.setGameMode("letters");
  assert.equal(game.publicState().gameMode, "letters");

  game.setPairMode("manual");
  assert.equal(game.publicState().pairMode, "manual");

  game.start("p1");
  assert.throws(() => game.setGameMode("chain"), /phòng chờ/);
  assert.throws(() => game.setPairMode("random"), /phòng chờ/);
});

test("luồng chơi cơ bản: chia lượt, cộng điểm, nối âm tiết cuối", (t) => {
  const game = new GameHost({
    code: "ABC12",
    hostName: "An",
    dictionary,
    turnSeconds: 120,
  });
  t.after(() => game.destroy());

  assert.throws(() => game.start("p1"), /2 người/);

  game.addPlayer({ name: "Bình" });
  game.addPlayer({ name: "Chi" });
  assert.throws(() => game.start("p2"), /Chỉ chủ phòng/);

  game.start("p1");
  let state = game.publicState();
  assert.equal(state.phase, "playing");
  assert.equal(state.usedCount, 0);

  const firstId = state.turnPlayerId;
  const first = game.submit(firstId, "bánh mì");
  assert.equal(first.ok, true);

  state = game.publicState();
  assert.equal(state.requiredSyllable, "mì");
  assert.equal(state.players.find((player) => player.id === firstId).score, 1);
  assert.equal(state.usedCount, 1);
  assert.notEqual(state.turnPlayerId, firstId);

  const secondId = state.turnPlayerId;
  const idleId = state.players.find((player) => player.id !== firstId && player.id !== secondId).id;
  assert.equal(game.submit(idleId, "mì gói").ok, false);

  const second = game.submit(secondId, "mì gói");
  assert.equal(second.ok, true);
  state = game.publicState();
  assert.equal(state.requiredSyllable, "gói");
  assert.equal(state.usedCount, 2);

  const invalid = game.submit(state.turnPlayerId, "bánh mì");
  assert.equal(invalid.ok, false);
  assert.match(invalid.reason, /bắt đầu bằng/);
});

test("chế độ khắt khe áp dụng trong ván chơi", (t) => {
  const game = new GameHost({ code: "STR01", hostName: "An", dictionary, turnSeconds: 120 });
  t.after(() => game.destroy());
  game.addPlayer({ name: "Bình" });
  game.setMode("strict");
  game.start("p1");

  const state = game.publicState();
  const result = game.submit(state.turnPlayerId, "con mèo");
  assert.equal(result.ok, false);
  assert.match(result.reason, /Khắt khe/);
});

test("người chơi mất kết nối trong ván sẽ bị chuyển lượt", (t) => {
  const game = new GameHost({ code: "OFF01", hostName: "An", dictionary, turnSeconds: 120 });
  t.after(() => game.destroy());
  game.addPlayer({ name: "Bình" });
  game.addPlayer({ name: "Chi" });
  game.start("p1");

  let state = game.publicState();
  const currentId = state.turnPlayerId;
  assert.equal(game.removePlayer(currentId), true);

  state = game.publicState();
  const removed = state.players.find((player) => player.id === currentId);
  assert.equal(removed.online, false);
  assert.notEqual(state.turnPlayerId, currentId);
  assert.equal(game.removePlayer(currentId), false);
});

test("kết thúc, chơi lại và trở về phòng chờ", (t) => {
  const game = new GameHost({ code: "END01", hostName: "An", dictionary, turnSeconds: 120 });
  t.after(() => game.destroy());
  game.addPlayer({ name: "Bình" });
  game.addPlayer({ name: "Chi" });
  game.start("p1");

  const firstId = game.publicState().turnPlayerId;
  assert.equal(game.submit(firstId, "bánh mì").ok, true);

  assert.throws(() => game.end("p2"), /Chỉ chủ phòng/);
  game.end("p1");

  let state = game.publicState();
  assert.equal(state.phase, "ended");
  assert.deepEqual(state.winners, [firstId]);

  game.restart("p1");
  state = game.publicState();
  assert.equal(state.phase, "playing");
  assert.equal(state.usedCount, 0);
  assert.equal(state.requiredSyllable, null);
  assert.equal(state.players.every((player) => player.score === 0), true);

  game.backToLobby("p1");
  state = game.publicState();
  assert.equal(state.phase, "lobby");
  assert.equal(state.turnPlayerId, null);
  assert.equal(state.history.length, 0);
});

test("giới hạn tối đa 10 người chơi", (t) => {
  const game = new GameHost({ code: "MAX01", hostName: "An", dictionary, turnSeconds: 120 });
  t.after(() => game.destroy());

  for (let i = 2; i <= MAX_PLAYERS; i += 1) {
    game.addPlayer({ name: `Người ${i}` });
  }
  assert.equal(game.publicState().players.length, MAX_PLAYERS);
  assert.throws(() => game.addPlayer({ name: "Người thừa" }), /đủ 10 người/);
});

test("danh hiệu: bộ quy tắc đầy đủ và duy nhất", () => {
  assert.ok(TITLE_RULES.some((title) => title.id === "king" && title.name === "Vua Tiếng Việt"));
  assert.equal(new Set(TITLE_RULES.map((title) => title.id)).size, TITLE_RULES.length);
  for (const title of TITLE_RULES) {
    assert.ok(title.name.length > 2, title.id);
    assert.ok(title.criteria.length > 20, title.id);
    assert.match(title.tone, /^(gold|sky|mint|violet|rose|orange|green)$/);
  }
});

test("danh hiệu: trao đúng theo điểm, âm tiết, tốc độ, sáng tạo, chuỗi và từ dài", () => {
  const players = [
    titlePlayer("p1", "An", 7, {
      words: 5,
      syllables: 12,
      creativeWords: 3,
      timedAnswers: 5,
      answerMsTotal: 9000,
      bestStreak: 5,
      longWords: 2,
    }),
    titlePlayer("p2", "Bình", 7, {
      words: 4,
      syllables: 8,
      creativeWords: 1,
      timedAnswers: 4,
      answerMsTotal: 6000,
      bestStreak: 4,
    }),
    titlePlayer("p3", "Chi", 3, {
      words: 3,
      syllables: 6,
      creativeWords: 4,
      timedAnswers: 3,
      answerMsTotal: 15000,
      mistakes: 1,
      bestStreak: 2,
      longWords: 1,
    }),
  ];

  const titles = computeTitles(players, { mode: "smart", gameMode: "chain" });
  const ids = (id) => titles.find((award) => award.id === id)?.playerIds;

  assert.deepEqual(ids("king"), ["p1", "p2"]);
  assert.deepEqual(ids("syllableMaster"), ["p1"]);
  assert.deepEqual(ids("lightning"), ["p2"]);
  assert.deepEqual(ids("creator"), ["p3"]);
  assert.deepEqual(ids("flawless"), ["p1", "p2"]);
  assert.deepEqual(ids("streak"), ["p1"]);
  assert.deepEqual(ids("bigTree"), ["p1", "p3"]);
});

test("danh hiệu: áp dụng ngưỡng, chế độ Khắt khe và luật Đôi chữ cái", () => {
  const low = [
    titlePlayer("p1", "An", 1, {
      words: 1,
      syllables: 2,
      timedAnswers: 1,
      answerMsTotal: 3000,
    }),
  ];
  assert.deepEqual(
    computeTitles(low, { mode: "smart", gameMode: "chain" }).map((award) => award.id),
    ["king"]
  );

  const strict = [
    titlePlayer("p1", "An", 3, {
      words: 3,
      syllables: 6,
      creativeWords: 5,
      timedAnswers: 3,
      answerMsTotal: 9000,
      bestStreak: 3,
    }),
  ];
  const strictIds = computeTitles(strict, { mode: "strict", gameMode: "chain" }).map(
    (award) => award.id
  );
  assert.ok(!strictIds.includes("creator"));
  assert.ok(strictIds.includes("flawless"));
  assert.ok(strictIds.includes("syllableMaster"));
  assert.ok(strictIds.includes("streak"));

  const letters = [
    titlePlayer("p1", "An", 3, {
      words: 3,
      syllables: 6,
      timedAnswers: 3,
      answerMsTotal: 9000,
      bestStreak: 3,
      longWords: 3,
    }),
  ];
  const lettersIds = computeTitles(letters, { mode: "smart", gameMode: "letters" }).map(
    (award) => award.id
  );
  assert.ok(lettersIds.includes("king"));
  assert.ok(!lettersIds.includes("bigTree"));
});

test("danh hiệu: engine ghi nhận thống kê và trả về danh hiệu khi kết thúc", (t) => {
  const game = new GameHost({ code: "TITLE1", hostName: "An", dictionary, turnSeconds: 120 });
  t.after(() => game.destroy());
  game.addPlayer({ name: "Bình" });
  game.start("p1");

  let state = game.publicState();
  const firstId = state.turnPlayerId;
  const player = game.players.find((item) => item.id === firstId);

  assert.equal(game.submit(firstId, "mèo").ok, false);
  assert.equal(player.stats.mistakes, 1);
  assert.equal(player.stats.streak, 0);

  assert.equal(game.submit(firstId, "bánh mì").ok, true);
  assert.equal(player.stats.words, 1);
  assert.equal(player.stats.syllables, 2);
  assert.equal(player.stats.timedAnswers, 1);
  assert.ok(player.stats.answerMsTotal >= 1);
  assert.equal(player.stats.bestStreak, 1);

  state = game.publicState();
  assert.ok(state.history[0].elapsedMs >= 1);

  game.end("p1");
  state = game.publicState();
  assert.deepEqual(
    state.titles.find((award) => award.id === "king")?.playerIds,
    [firstId]
  );
  assert.ok(
    state.players.find((item) => item.id === firstId).titleIds.includes("king")
  );
  assert.ok(
    !state.players.find((item) => item.id !== firstId).titleIds.includes("king")
  );

  game.restart("p1");
  state = game.publicState();
  assert.deepEqual(state.titles, []);
  assert.equal(game.players.find((item) => item.id === firstId).stats.words, 0);
});
