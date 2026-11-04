import { REBUS_QUESTIONS } from "./rebus.js";
import { prepareQuestions } from "./image-quiz-core.js";

let cache = null;

// Only curated comic rebuses are used: the old easy object-name emoji list
// and Wikipedia thumbnail importer are NOT added to this game mode.
export async function loadImageQuizQuestions() {
  if (cache) return cache;
  let extra = [];
  try {
    const response = await fetch("assets/image-quiz/rebus-questions.json", { cache: "no-cache" });
    if (response.ok) {
      const payload = await response.json();
      extra = Array.isArray(payload) ? payload : payload.questions;
    }
  } catch {
    // Original built-in comic scenes always work without external images.
  }
  const candidates = [...(Array.isArray(extra) ? extra : []), ...REBUS_QUESTIONS];
  const ids = new Set();
  cache = prepareQuestions(candidates).filter((q) => {
    if (ids.has(q.id)) return false;
    ids.add(q.id);
    return true;
  });
  return cache;
}
