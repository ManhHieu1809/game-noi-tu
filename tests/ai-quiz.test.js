import test from "node:test";
import assert from "node:assert/strict";
import { OBJECT_QUESTIONS } from "../js/games/image-quiz/objects.js";
import { REBUS_QUESTIONS } from "../js/games/image-quiz/rebus.js";
import { normalizeGuess } from "../js/games/image-quiz/image-quiz-core.js";
import {
  slug, artworkId, makePrompt, selectPlan, parseAssessment,
  approveAssessment, newEntry, prioritizeAi, isWebp,
} from "../scripts/ai-quiz-lib.mjs";

test("AI prompt planner has at least 300 unique answer targets across 2 modes", () => {
  const obj = [...new Set(OBJECT_QUESTIONS.map((q) => normalizeGuess(q.answer)))];
  const idioms = [...new Set(REBUS_QUESTIONS.map((q) => normalizeGuess(q.answer)))];
  assert.ok(obj.length >= 240);
  assert.ok(idioms.length >= 60);
  assert.equal(new Set(obj.slice(0, 240)).size, 240);
  assert.equal(new Set(idioms.slice(0, 60)).size, 60);
});

test("prompt intentionally creates clear but troll-like images with no answer text", () => {
  const imagePrompt = makePrompt("object", OBJECT_QUESTIONS[0]);
  const rebusPrompt = makePrompt("idiom", REBUS_QUESTIONS[0], "comic");
  assert.match(imagePrompt, /deceptive|deceptive|misleading|tricky|clever|FAIR/);
  assert.match(imagePrompt, /NO written text/);
  assert.match(rebusPrompt, /three-panel/);
  assert.match(rebusPrompt, /idiom\/proverb/);
});

test("planner skips accepted and failed normalized answers across repeated batches", () => {
  const sample = OBJECT_QUESTIONS.slice(0, 4);
  const first = selectPlan({ mode: "object", questions: sample, limit: 2 });
  assert.equal(first.length, 2);
  const accepted = [{ id: first[0].id, answer: first[0].item.answer }];
  const skipped = [normalizeGuess(first[1].item.answer)];
  const next = selectPlan({ mode: "object", questions: sample, existing: accepted, rejectedAnswers: skipped, limit: 2 });
  assert.equal(next.length, 2);
  const keys = [first[0].item.answer, first[1].item.answer, ...next.map((p) => p.item.answer)].map(normalizeGuess);
  assert.equal(new Set(keys).size, keys.length);
});

test("only strong, safe visual assessments are auto-approved", () => {
  const strong = parseAssessment('{"targetAccuracy":9,"recognizable":8,"visualHumor":8,"fairChallenge":8,"containsText":false,"unsafe":false}');
  assert.equal(approveAssessment(strong), true);
  assert.equal(approveAssessment({ ...strong, containsText: true }), false);
  assert.equal(approveAssessment({ ...strong, targetAccuracy: 3 }), false);
  assert.equal(approveAssessment({ ...strong, fairChallenge: 10 }), false);
  assert.throws(() => parseAssessment('{"targetAccuracy":12}'));
});

test("AI metadata is local, retains the exact answer, and deduplicates against Wikimedia", () => {
  const obj = OBJECT_QUESTIONS[0];
  const ai = newEntry("object", obj, artworkId("object", obj), "gpt-image-2.5-flare", "surreal", { targetAccuracy: 9 });
  assert.equal(ai.answer, obj.answer);
  assert.match(ai.imageUrl, /^assets\/image-quiz\/ai\/object\/.+\.webp$/);
  assert.equal(ai.reviewStatus, "auto-approved");
  const selected = prioritizeAi([ai], [{ id: "wiki-1", answer: obj.answer, imageUrl: "https://example.org/x.webp" }, { id: "wiki-2", answer: "khác" }]);
  assert.equal(selected.length, 2);
  assert.equal(selected[0].sourceType, "ai");
  assert.equal(isWebp(Buffer.from("a random blob")), false);
  assert.throws(() => slug("???"));
});
