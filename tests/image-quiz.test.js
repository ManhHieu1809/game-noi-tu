import test from "node:test";
import assert from "node:assert/strict";
import { IMAGE_QUIZ_SEED } from "../js/games/image-quiz/seed.js";
import { REBUS_QUESTIONS } from "../js/games/image-quiz/rebus.js";
import { readFileSync } from "node:fs";
import { GameHost } from "../js/game-core.js";
import { normalizeGuess, prepareQuestions, chooseQuestions, ImageQuizRound } from "../js/games/image-quiz/image-quiz-core.js";

test("seed bank has diverse validated answers", () => {
  const questions = prepareQuestions(IMAGE_QUIZ_SEED);
  assert.ok(questions.length >= 100);
  assert.equal(new Set(questions.map((q) => normalizeGuess(q.answer))).size, questions.length);
});

test("accepts accent-insensitive aliases", () => {
  assert.equal(normalizeGuess("  MÈO!  "), "meo");
  assert.equal(normalizeGuess("Xe   Đạp"), "xe dap");
  const quiz = new ImageQuizRound({ questions: [{ id: "q1", answer: "Con mèo", aliases: ["mèo"], emoji: "🐈" }] });
  quiz.start();
  const now = 1000;
  const first = quiz.guess("p1", "mEO", now, now + 10000, 20000);
  assert.equal(first.ok, true);
  assert.equal(first.first, true);
  assert.equal(quiz.guess("p1", "mèo", now, now + 5000).ok, false);
  assert.equal(quiz.guess("p2", "CON MEO", now, now + 5000).ok, true);
});

test("public state hides answers until reveal", () => {
  const quiz = new ImageQuizRound({ questions: [{ id: "q", answer: "táo", aliases: [], emoji: "🍎" }] });
  quiz.start();
  assert.equal(quiz.publicState().answer, null);
  assert.equal(JSON.stringify(quiz.publicState()).includes("táo"), false);
  quiz.reveal();
  assert.equal(quiz.publicState().answer, "táo");
});

test("prefer unseen and never repeat an answer within a match", () => {
  const qs = prepareQuestions([
    { id: "1", answer: "mèo", emoji: "🐈" },
    { id: "2", answer: "mèo", emoji: "🐱" },
    { id: "3", answer: "chó", emoji: "🐕" },
    { id: "4", answer: "voi", emoji: "🐘" },
  ]);
  const chosen = chooseQuestions(qs, 3, ["1"], () => 0.5);
  assert.equal(chosen.length, 3);
  assert.equal(new Set(chosen.map((x) => normalizeGuess(x.answer))).size, 3);
  assert.equal(chosen.some((x) => x.id === "1"), false);
});

test("reject invalid URLs and malformed answers", () => {
  assert.equal(prepareQuestions([{ id: "unsafe", answer: "cat", imageUrl: "javascript:alert(1)" }]).length, 0);
  assert.equal(prepareQuestions([{ id: "valid", answer: "cat", imageUrl: "https://upload.wikimedia.org/a.jpg" }]).length, 1);
});

test("host coordinates simultaneous multiplayer guesses without leaking answers", () => {
  const dictionary = { words: new Set(["con mèo"]), syllables: new Set(["con", "mèo"]) };
  const game = new GameHost({
    code: "ABCDE", hostName: "Host", dictionary,
    imageQuestions: [{ id: "cat", answer: "con mèo", aliases: ["mèo"], emoji: "🐱" }],
  });
  const guest = game.addPlayer({ name: "Guest" });
  game.setGameMode("image");
  game.start(game.hostPlayerId);
  assert.equal(game.publicState().imageQuiz.answer, null);
  assert.equal(game.publicState().turnPlayerId, null);
  assert.equal(game.submit(game.hostPlayerId, "con meo").ok, true);
  assert.equal(game.submit(guest.id, "mèo").ok, true);
  assert.equal(game.publicState().imageQuiz.revealed, true);
  assert.equal(game.publicState().imageQuiz.answer, "con mèo");
  assert.ok(game.publicState().players.every((p) => p.score > 0));
  game.destroy();
});

test("already-seen answer is deprioritized even with a new photograph", () => {
  const qs = prepareQuestions([
    { id: "new-photo", answer: "mèo", emoji: "🐱" },
    { id: "new-answer", answer: "chó", emoji: "🐶" }
  ]);
  const deck = chooseQuestions(qs, 1, ["answer:meo"], () => 0.25);
  assert.equal(deck[0].answer, "chó");
});

test("curated meme comic bank includes 100+ distinct Vietnamese riddles", () => {
  const questions = prepareQuestions(REBUS_QUESTIONS);
  assert.ok(questions.length >= 100);
  assert.equal(new Set(questions.map((q) => normalizeGuess(q.answer))).size, questions.length);
  assert.ok(questions.every((q) => q.scene.length === 3));
  assert.ok(questions.every((q) => q.difficulty === "hard" || q.difficulty === "medium"));
});

test("continuous game reshuffles and NEVER stops when question bank is exhausted", () => {
  const quiz = new ImageQuizRound({ questions: [
    { id: "a", answer: "đầu voi đuôi chuột", scene: ["🐘", "✂️", "🐭"] },
    { id: "b", answer: "ăn cháo đá bát", scene: ["🥣", "🦶", "🥣"] },
    { id: "c", answer: "nước đổ đầu vịt", scene: ["🚿", "🦆", "😐"] }
  ] });
  assert.equal(quiz.start(), true);
  const firstThree = [quiz.current.id];
  for (let i = 0; i < 39; i++) {
    assert.equal(quiz.next(), true);
    assert.equal(quiz.publicState().round, i + 2);
    assert.equal(quiz.publicState().rounds, undefined);
    assert.equal(quiz.publicState().answer, null);
    if (i < 2) firstThree.push(quiz.current.id);
  }
  assert.equal(new Set(firstThree).size, 3);
  assert.equal(quiz.publicState().round, 40);
});

test("single puzzle pool still advances forever instead of ending", () => {
  const quiz = new ImageQuizRound({ questions: [{ id: "only", answer: "nước chảy đá mòn", scene: ["💧", "🪨"] }] });
  quiz.start();
  for (let i = 0; i < 15; i++) assert.equal(quiz.next(), true);
  assert.equal(quiz.publicState().round, 16);
});

test("host must explicitly end endless image game", () => {
  const dictionary = { words: new Set(["hoa hồng"]), syllables: new Set(["hoa", "hồng"]) };
  const game = new GameHost({ code: "ABCDE", hostName: "Host", dictionary, imageQuestions: REBUS_QUESTIONS.slice(0, 2) });
  const guest = game.addPlayer({ name: "Guest" });
  game.setGameMode("image");
  game.start(game.hostPlayerId);
  // Every timeout merely reveals an answer. A timer never ends the match.
  for (let i = 0; i < 6; i++) {
    game._revealImageRound();
    assert.equal(game.phase, "playing");
    game._clearQuizTransition();
    assert.equal(game.imageQuiz.next(), true);
    game.turnSeq += 1;
    game._startTimer();
  }
  assert.equal(game.phase, "playing");
  assert.throws(() => game.end(guest.id), /chủ phòng/);
  assert.equal(game.phase, "playing");
  game.end(game.hostPlayerId);
  assert.equal(game.phase, "ended");
  assert.equal(game.publicState().imageQuiz.round, 7);
  game.destroy();
});

test("game interface includes an accessible prominent end button", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(html, /id="imageQuizEndBtn"/);
  assert.match(html, /Kết thúc trò chơi/);
  assert.match(app, /imageQuizEndBtn\.addEventListener\("click", requestEndGame\)/);
  assert.match(app, /els\.imageQuizEndBtn\.hidden = app\.role !== "host"/);
});
