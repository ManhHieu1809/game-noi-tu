// Run: node scripts/build-image-quiz.mjs
// Optional opt-in asset enrichment; network access is required.
// Images remain remote Wikimedia/Wikipedia thumbnails, never bundled without attribution review.
import { mkdir, writeFile } from "node:fs/promises";
import { IMAGE_QUIZ_SEED } from "../js/games/image-quiz/seed.js";

const OUT = new URL("../assets/image-quiz/questions.json", import.meta.url);
const clean = (s) => String(s || "").normalize("NFC").trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const bank = [];
let failed = 0;
for (const question of IMAGE_QUIZ_SEED) {
  const title = question.wiki;
  if (!title) continue;
  const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "game-noi-tu-image-quiz/1.0 (educational open-source game; image metadata review required)", accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    const imageUrl = data.thumbnail?.source;
    if (!imageUrl || !imageUrl.startsWith("https://")) continue;
    bank.push({
      id: "wiki-" + question.id,
      answer: clean(question.answer),
      aliases: question.aliases || [],
      category: question.category,
      imageUrl,
      sourceUrl: data.content_urls?.desktop?.page || "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replaceAll(" ", "_")),
      attribution: "Image from Wikipedia/Wikimedia; verify file author and license before publication",
      license: "REVIEW REQUIRED",
    });
  } catch (error) {
    failed += 1;
    console.warn("Skipped", title, String(error.message || error));
  }
  // Be courteous with Wikimedia endpoints.
  await sleep(250);
}
await mkdir(new URL("../assets/image-quiz/", import.meta.url), { recursive: true });
await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), questions: bank }, null, 2) + "\n");
console.log("Imported", bank.length, "photo prompts;", failed, "fetch failures. Review license metadata before deployment.");
