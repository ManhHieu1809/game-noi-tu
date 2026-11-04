import test from "node:test";
import assert from "node:assert/strict";
import { IMAGE_QUIZ_SEED } from "../js/games/image-quiz/seed.js";
import { REBUS_QUESTIONS } from "../js/games/image-quiz/rebus.js";
import { OBJECT_QUESTIONS } from "../js/games/image-quiz/objects.js";
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

test("never reuses a question or normalized answer, including on a later session", () => {
  const questions = [
    { id: "a", answer: "đầu voi đuôi chuột", scene: ["🐘", "✂️", "🐭"] },
    { id: "b", answer: "đầu voi đuôi chuột", scene: ["🐘", "🐭"] },
    { id: "c", answer: "ăn cháo đá bát", scene: ["🥣", "🦶", "🥣"] },
    { id: "d", answer: "nước đổ đầu vịt", scene: ["🚿", "🦆", "😐"] }
  ];
  const persisted = new Set();
  const onSeen = (id, answerKey) => { persisted.add(id); persisted.add(answerKey); };
  const first = new ImageQuizRound({ questions, onSeen });
  assert.equal(first.start(), true);
  const selected = new Set([normalizeGuess(first.current.answer)]);
  assert.equal(first.next(), true);
  assert.equal(selected.has(normalizeGuess(first.current.answer)), false);
  selected.add(normalizeGuess(first.current.answer));
  assert.equal(first.next(), true);
  assert.equal(selected.has(normalizeGuess(first.current.answer)), false);
  assert.equal(first.next(), false);
  assert.equal(first.publicState().exhausted, true);
  assert.equal(first.publicState().answer, null);
  assert.equal(first.publicState().round, 3);
  const second = new ImageQuizRound({ questions, seenIds: [...persisted] });
  assert.equal(second.start(), false);
  assert.equal(second.remainingCount(), 0);
});

test("one-question pool pauses after the first answer instead of recycling", () => {
  const quiz = new ImageQuizRound({ questions: [{ id: "only", answer: "nước chảy đá mòn", scene: ["💧", "🪨"] }] });
  assert.equal(quiz.start(), true);
  assert.equal(quiz.next(), false);
  assert.equal(quiz.publicState().round, 1);
  assert.equal(quiz.publicState().exhausted, true);
});

test("host-only end with exhausted image pool, never auto-end", () => {
  const dictionary = { words: new Set(["hoa hồng"]), syllables: new Set(["hoa", "hồng"]) };
  const game = new GameHost({ code: "ABCDE", hostName: "Host", dictionary, imageQuestions: REBUS_QUESTIONS.slice(0, 2) });
  const guest = game.addPlayer({ name: "Guest" });
  game.setGameMode("image");
  game.start(game.hostPlayerId);
  assert.equal(game.publicState().imageQuiz.exhausted, false);
  game._revealImageRound();
  game._clearQuizTransition();
  assert.equal(game.imageQuiz.next(), true);
  game._revealImageRound();
  game._clearQuizTransition();
  assert.equal(game.imageQuiz.next(), false);
  assert.equal(game.phase, "playing");
  assert.equal(game.publicState().imageQuiz.exhausted, true);
  assert.throws(() => game.end(guest.id), /chủ phòng/);
  game.end(game.hostPlayerId);
  assert.equal(game.phase, "ended");
  game.destroy();
});

test("host switches image submodes in lobby and both banks stay independent", () => {
  const dict = { words: new Set(["hoa hồng"]), syllables: new Set(["hoa", "hồng"]) };
  const idiom = { id: "idiom-one", answer: "đầu voi đuôi chuột", scene: ["🐘", "✂️", "🐭"] };
  const object = { id: "object-one", answer: "con mèo", emoji: "🐈" };
  const history = [];
  const game = new GameHost({
    code: "ABCDE", hostName: "Host", dictionary: dict,
    imageQuestions: { idiom: [idiom], object: [object] },
    imageSeenIds: { idiom: [], object: [] },
    onImageSeen: (...args) => history.push(args),
  });
  const guest = game.addPlayer({ name: "Guest" });
  game.setGameMode("image");
  assert.equal(game.publicState().imageQuizAvailable, 1);
  game.setImageQuizMode("object");
  assert.equal(game.publicState().imageQuizMode, "object");
  game.start(game.hostPlayerId);
  assert.equal(game.publicState().imageQuiz.id, object.id);
  assert.equal(history[0][0], "object");
  assert.throws(() => game.setImageQuizMode("idiom"), /phòng chờ/);
  game.end(game.hostPlayerId);
  game.backToLobby(game.hostPlayerId);
  game.setImageQuizMode("idiom");
  game.start(game.hostPlayerId);
  assert.equal(game.publicState().imageQuiz.id, idiom.id);
  game.destroy();
});

test("400+ hard object prompts and 100+ idioms have unique normalized answers", () => {
  const objects = prepareQuestions(OBJECT_QUESTIONS);
  const idioms = prepareQuestions(REBUS_QUESTIONS);
  assert.ok(objects.length >= 400, "Expected 400+ curated object names");
  assert.ok(idioms.length >= 100);
  for (const bank of [objects, idioms]) {
    assert.equal(new Set(bank.map((q) => normalizeGuess(q.answer))).size, bank.length);
  }
  assert.ok(OBJECT_QUESTIONS.some((q) => q.wiki));
});

test("game interface includes an accessible prominent end button", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(html, /id="imageQuizEndBtn"/);
  assert.match(html, /id="imageQuizModeSelect"/);
  assert.match(html, /value="idiom"/);
  assert.match(html, /value="object"/);
  assert.match(html, /Kết thúc trò chơi/);
  assert.match(app, /imageQuizEndBtn\.addEventListener\("click", requestEndGame\)/);
  assert.match(app, /els\.imageQuizEndBtn\.hidden = app\.role !== "host"/);
});

test("changing a submode after start is rejected", () => {
  const dict = { words: new Set(["mèo"]), syllables: new Set(["mèo"]) };
  const game = new GameHost({ code: "ABCDE", hostName: "H", dictionary: dict, imageQuestions: { idiom: REBUS_QUESTIONS, object: OBJECT_QUESTIONS } });
  game.addPlayer({ name: "G" });
  game.setGameMode("image");
  game.start(game.hostPlayerId);
  assert.throws(() => game.setImageQuizMode("object"), /phòng chờ/);
  game.destroy();
});

test("switching submodes in the same room does not bring back played objects", () => {
  const dict = { words: new Set(), syllables: new Set() };
  const game = new GameHost({
    code: "ABCDE", hostName: "Host", dictionary: dict,
    imageQuestions: { idiom: [{ id: "idiom-a", answer: "ăn cháo đá bát", scene: ["🥣", "🦶"] }],
      object: [{ id: "obj-a", answer: "máy ảnh", emoji: "📷" }, { id: "obj-b", answer: "bàn phím", emoji: "⌨️" }] },
    imageSeenIds: { idiom: [], object: [] },
  });
  game.addPlayer({ name: "Guest" });
  game.setGameMode("image");
  game.setImageQuizMode("object");
  game.start(game.hostPlayerId);
  assert.equal(game.publicState().imageQuizAvailable, null);
  game.end(game.hostPlayerId);
  game.backToLobby(game.hostPlayerId);
  assert.equal(game.publicState().imageQuizAvailable, 1);
  game.setImageQuizMode("idiom");
  game.setImageQuizMode("object");
  assert.equal(game.publicState().imageQuizAvailable, 1);
  game.destroy();
});

test("group history received from a guest is validated and prevents repeats", () => {
  const dict = { words: new Set(), syllables: new Set() };
  const objectBank = [
    { id: "obj-1", answer: "con mèo", emoji: "🐱" },
    { id: "obj-2", answer: "con chó", emoji: "🐶" },
    { id: "obj-3", answer: "con voi", emoji: "🐘" },
  ];
  const game = new GameHost({
    code: "ABCDE", hostName: "Host", dictionary: dict,
    imageQuestions: { idiom: [], object: objectBank },
    imageSeenIds: { idiom: [], object: [] },
  });
  game.setGameMode("image");
  game.setImageQuizMode("object");
  assert.equal(game.publicState().imageQuizAvailable, 3);
  game.mergeImageSeenHistory({
    object: ["answer:con meo", "answer:fake answer", "answer:con meo"]
  });
  assert.equal(game.publicState().imageQuizAvailable, 2);
  game.addPlayer({ name: "Guest" });
  game.start(game.hostPlayerId);
  assert.notEqual(normalizeGuess(game.imageQuiz.current.answer), "con meo");
  // A guest cannot use history messages to bypass the host-only end rule.
  assert.throws(() => game.end("p2"), /chủ phòng/);
  game.destroy();
});

test("group histories are ignored after a round has started", () => {
  const dict = { words: new Set(), syllables: new Set() };
  const game = new GameHost({
    code: "ABCDE", hostName: "Host", dictionary: dict,
    imageQuestions: { idiom: [{ id: "a", answer: "uống nước nhớ nguồn", emoji: "💧" }], object: [] },
  });
  game.addPlayer({ name: "G" });
  game.setGameMode("image");
  game.start(game.hostPlayerId);
  game.mergeImageSeenHistory({ idiom: ["answer:uong nuoc nho nguon"] });
  assert.equal(game.phase, "playing");
  assert.ok(game.imageQuiz.current);
  game.destroy();
});

test("guests' previously seen picture IDs exclude alternate photos of the answer", () => {
  const dict = { words: new Set(), syllables: new Set() };
  const photoBank = [
    { id: "photo-a", answer: "mèo", emoji: "🐱" },
    { id: "photo-b", answer: "mèo", emoji: "🐈" },
    { id: "photo-c", answer: "chó", emoji: "🐶" }
  ];
  const game = new GameHost({
    code: "ABCDE", hostName: "Host", dictionary: dict,
    imageQuestions: { idiom: [], object: photoBank },
    imageSeenIds: { idiom: [], object: [] }
  });
  game.setGameMode("image");
  game.setImageQuizMode("object");
  game.mergeImageSeenHistory({ object: ["photo-b", "fake-photo"] });
  assert.equal(game.publicState().imageQuizAvailable, 1);
  game.addPlayer({ name: "Guest" });
  game.start(game.hostPlayerId);
  assert.equal(game.imageQuiz.current.answer, "chó");
  game.destroy();
});

test("bundled Wikimedia photo bank has 200+ distinct source photographs", () => {
  const { questions } = JSON.parse(readFileSync(new URL("../assets/image-quiz/object-questions.json", import.meta.url), "utf8"));
  assert.ok(questions.length >= 200, "Expected a substantial photo bank");
  assert.equal(new Set(questions.map((q) => q.imageUrl)).size, questions.length);
  assert.equal(new Set(questions.map((q) => q.sourceUrl)).size, questions.length);
  assert.equal(new Set(questions.map((q) => normalizeGuess(q.answer))).size, questions.length);
  assert.ok(questions.every((q) => q.imageUrl.startsWith("https://") && q.license && q.sourceUrl));
});


test("object image CSS inherits live reveal/crop variables from quiz panel", () => {
  const css = readFileSync(new URL("../css/image-quiz.css", import.meta.url), "utf8");
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  // CSS must NOT shadow custom properties set via imageQuizPanel.style.
  const objectPanel = css.match(/\.image-quiz--object\s*\{([^}]+)\}/);
  assert.ok(objectPanel, "Object panel needs default visibility variables");
  assert.match(objectPanel[1], /--quiz-reveal:\s*0\s*;/);
  assert.match(objectPanel[1], /--focus-x:\s*52%/);
  const innerVisual = css.match(/\.image-quiz--object \.image-quiz__visual\s*\{([^}]+)\}/);
  assert.ok(innerVisual);
  assert.doesNotMatch(innerVisual[1], /--(?:quiz-reveal|focus-x|focus-y)\s*:/);
  assert.match(app, /imageQuizPanel\.style\.setProperty\("--quiz-reveal", String\(initialReveal\)\)/);
  assert.match(app, /imageQuizPanel\.style\.setProperty\("--quiz-reveal", String\(reveal\)\)/);
  // Accessibility reduced-motion preferences must not bypass puzzle blur.
  assert.doesNotMatch(css, /prefers-reduced-motion[\s\S]*?\.image-quiz--object[^}]+filter:\s*none/);
});


test("full object photo is visible on answer reveal and by 75% of turn time", () => {
  const css = readFileSync(new URL("../css/image-quiz.css", import.meta.url), "utf8");
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(css, /\.image-quiz--object\.image-quiz--revealed \.image-quiz__visual img/);
  assert.match(css, /clip-path:\s*none/);
  assert.match(css, /transform:\s*none/);
  assert.match(app, /const initialReveal = [^\n]+\/ 0\.75/);
  assert.match(app, /const reveal = [^\n]+\/ 0\.75/);
});
