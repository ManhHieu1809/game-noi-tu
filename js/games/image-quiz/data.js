import { IMAGE_QUIZ_SEED } from "./seed.js";
import { prepareQuestions } from "./image-quiz-core.js";

let cache = null;

// The reviewed, optionally Wikimedia-enriched JSON takes precedence.
// Falls back to the 120+ built-in emoji illustrations if no photo bank was generated.
export async function loadImageQuizQuestions() {
  if (cache) return cache;
  let bank = [];
  try {
    const response = await fetch("assets/image-quiz/questions.json", { cache: "no-cache" });
    if (response.ok) {
      const payload = await response.json();
      bank = prepareQuestions(Array.isArray(payload) ? payload : payload.questions);
    }
  } catch {
    // Offline/local fallback is intentional.
  }
  const combined = [...bank, ...prepareQuestions(IMAGE_QUIZ_SEED)];
  const ids = new Set();
  cache = combined.filter((item) => {
    if (ids.has(item.id)) return false;
    ids.add(item.id);
    return true;
  });
  return cache;
}
