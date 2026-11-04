import { REBUS_QUESTIONS } from "./rebus.js";
import { OBJECT_QUESTIONS } from "./objects.js";
import { prepareQuestions } from "./image-quiz-core.js";

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

// Two independent, curated question banks.
// Photo bank is optional: the difficult gradual-crop game remains playable
// with 467 built-in visual fallback prompts without a network connection.
export async function loadImageQuizQuestions() {
  if (cache) return cache;
  const [rebusExtra, objectExtra] = await Promise.all([
    loadOptionalBank("assets/image-quiz/rebus-questions.json"),
    loadOptionalBank("assets/image-quiz/object-questions.json"),
  ]);
  // When a substantial real-photo bank is present, use it exclusively.
  // Unillustrated seed objects remain candidates for future Wikimedia imports
  // but are intentionally not shown as obvious full emoji hints in this mode.
  const photoBank = combine(objectExtra, []).filter((q) => Boolean(q.imageUrl));
  cache = {
    idiom: combine(rebusExtra, REBUS_QUESTIONS),
    object: photoBank.length >= 40 ? photoBank : combine(objectExtra, OBJECT_QUESTIONS),
  };
  return cache;
}
