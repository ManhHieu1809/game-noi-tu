import { REBUS_QUESTIONS } from "./rebus.js";
import { OBJECT_QUESTIONS } from "./objects.js";
import { prepareQuestions, normalizeGuess } from "./image-quiz-core.js";

let cache = null;

async function loadOptionalBank(path) {
  try {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload) ? payload : Array.isArray(payload.questions) ? payload.questions : [];
  } catch {
    return [];
  }
}

function combine(online, builtIn) {
  const ids = new Set();
  return prepareQuestions([...online, ...builtIn]).filter((item) => {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
}

// AI art takes precedence only after it passes automatic image review.
// No duplicate answers across AI photos, Wikimedia photos, or emoji fallback.
function uniqueAnswers(questions) {
  const seen = new Set();
  return questions.filter((item) => {
    const key = normalizeGuess(item.answer);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function approvedAi(list, mode) {
  const prefix = "assets/image-quiz/ai/" + mode + "/";
  return list.filter((item) =>
    item?.sourceType === "ai" &&
    item?.reviewStatus === "auto-approved" &&
    typeof item?.imageUrl === "string" &&
    item.imageUrl.startsWith(prefix) &&
    /^assets\/image-quiz\/ai\/(object|idiom)\/ai-[a-z0-9-]+\.webp$/.test(item.imageUrl)
  );
}

export async function loadImageQuizQuestions() {
  if (cache) return cache;
  const [rebusExtra, objectExtra, aiIdiom, aiObject] = await Promise.all([
    loadOptionalBank("assets/image-quiz/rebus-questions.json"),
    loadOptionalBank("assets/image-quiz/object-questions.json"),
    loadOptionalBank("assets/image-quiz/ai-idiom-questions.json"),
    loadOptionalBank("assets/image-quiz/ai-object-questions.json"),
  ]);
  const photoBank = combine(objectExtra, []).filter((item) => Boolean(item.imageUrl));
  const baseObjects = photoBank.length >= 40 ? photoBank : combine(objectExtra, OBJECT_QUESTIONS);
  cache = {
    idiom: uniqueAnswers(combine([...approvedAi(aiIdiom, "idiom"), ...rebusExtra], REBUS_QUESTIONS)),
    object: uniqueAnswers(combine(approvedAi(aiObject, "object"), baseObjects)),
  };
  return cache;
}
