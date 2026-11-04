import test from "node:test";
import assert from "node:assert/strict";
import { IMAGE_QUIZ_SEED } from "../js/games/image-quiz/seed.js";
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
