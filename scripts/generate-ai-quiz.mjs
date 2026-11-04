// Generate troll-style visual riddles in bounded batches; automatic AI QA.
// Node.js 22+. Run with --dry-run to preview prompts without API usage.
// API key stays exclusively in OPENAI_API_KEY (never exposed to the browser).
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { OBJECT_QUESTIONS } from "../js/games/image-quiz/objects.js";
import { REBUS_QUESTIONS } from "../js/games/image-quiz/rebus.js";
import {
  selectPlan, isWebp, parseAssessment, approveAssessment, newEntry,
} from "./ai-quiz-lib.mjs";

const arg = (name, fallback) => {
  const found = process.argv.find((v) => v.startsWith("--" + name + "="));
  return found ? found.slice(name.length + 3) : fallback;
};
const opt = {
  mode: arg("mode", "object"),
  style: arg("style", "misdirection"),
  limit: Number(arg("limit", "2")),
  variants: Number(arg("variants", "1")),
  attempts: Number(arg("attempts", "2")),
  start: Number(arg("start", "0")),
  model: arg("model", "gpt-image-2.5-flare"),
  judge: arg("judge-model", "gpt-4.1-mini"),
  dryRun: process.argv.includes("--dry-run"),
};
if (!["object", "idiom"].includes(opt.mode)) throw new Error("Mode must be object or idiom");
if (!Number.isInteger(opt.attempts) || opt.attempts < 1 || opt.attempts > 2) {
  throw new Error("Attempts must be 1 or 2 to control API cost");
}
if (!/^[\w.-]{3,80}$/.test(opt.model) || !/^[\w.-]{3,80}$/.test(opt.judge)) {
  throw new Error("Invalid model name");
}
const key = process.env.OPENAI_API_KEY;
if (!opt.dryRun && (!key || !key.startsWith("sk-"))) {
  throw new Error("Missing OPENAI_API_KEY. Configure it as a GitHub Actions secret, or run --dry-run first.");
}
const root = path.resolve(new URL("..", import.meta.url).pathname);
const manifestPath = path.join(root, "assets", "image-quiz", "ai-" + opt.mode + "-questions.json");
const reportPath = path.join(root, "assets", "image-quiz", "ai", opt.mode + "-last-report.json");
const rejectedPath = path.join(root, "assets", "image-quiz", "ai", opt.mode + "-rejected-answers.json");
const questions = opt.mode === "object" ? OBJECT_QUESTIONS : REBUS_QUESTIONS;

async function readManifest() {
  try {
    const raw = JSON.parse(await readFile(manifestPath, "utf8"));
    if (!Array.isArray(raw.questions)) throw new Error("Invalid manifest");
    return raw;
  } catch (e) {
    if (e.code === "ENOENT") return { version: 1, mode: opt.mode, questions: [] };
    throw e;
  }
}
const manifest = await readManifest();
let rejectedAnswers = [];
try {
  rejectedAnswers = JSON.parse(await readFile(rejectedPath, "utf8"));
  if (!Array.isArray(rejectedAnswers)) rejectedAnswers = [];
} catch (err) { if (err.code !== "ENOENT") throw err; }
const plan = selectPlan({
  mode: opt.mode,
  questions,
  existing: manifest.questions,
  rejectedAnswers,
  limit: opt.limit,
  variants: opt.variants,
  style: opt.style,
  start: opt.start,
});

console.log("AI artwork batch mode: " + opt.mode + "; style: " + opt.style +
  "; new images planned: " + plan.length + "; attempts per item: " + opt.attempts);
for (const candidate of plan) {
  console.log(" - " + candidate.id + " => " + candidate.item.answer);
  if (opt.dryRun) console.log(candidate.prompt + "\n");
}
if (opt.dryRun || !plan.length) {
  console.log(opt.dryRun ? "DRY RUN: no API calls, no charge, no files changed." : "No unused answers left in this selection.");
  process.exit(0);
}

async function callOpenAI(endpoint, body, timeoutMs) {
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/" + endpoint, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new Error("OpenAI request failed: " + e.message);
  }
  if (!response.ok) {
    const error = new Error("OpenAI " + endpoint + " returned HTTP " + response.status);
    error.rateLimited = response.status === 429 || response.status >= 500;
    throw error;
  }
  return response.json();
}

async function createArtwork(prompt) {
  const output = await callOpenAI("images/generations", {
    model: opt.model, prompt, n: 1, size: "1536x1024",
    quality: "medium", output_format: "webp", output_compression: 78,
  }, 240000);
  const b64 = output?.data?.[0]?.b64_json;
  if (!b64 || typeof b64 !== "string") throw new Error("Image API returned no base64 image");
  const image = Buffer.from(b64, "base64");
  if (!isWebp(image) || image.length > 15 * 1024 * 1024) throw new Error("Invalid or oversized WEBP data");
  return image;
}

function judgePrompt(item, mode) {
  return [
    "You are an independent strict visual puzzle quality reviewer. Evaluate the IMAGE provided, not the creator's intentions.",
    "Expected answer in Vietnamese: " + item.answer,
    "Puzzle mode: " + mode,
    "Give 4 integer scores from 0 to 10: targetAccuracy (does image really show or convey the answer?), recognizable (can an observant human fairly infer it?), visualHumor (creative funny misdirection?), fairChallenge (interesting but not absurdly confusing?).",
    "Set containsText=true if ANY visible letters, numbers, watermark or label could reveal the answer.",
    "Set unsafe=true if disturbing, sexual, hateful or otherwise unsuitable for a casual all-ages game.",
    "Be critical. A normal obvious stock-like object photo should get low visualHumor/fairChallenge. An image showing the wrong target gets low targetAccuracy.",
    "Return ONLY a JSON object with keys targetAccuracy, recognizable, visualHumor, fairChallenge, containsText, unsafe and note. No Markdown.",
  ].join("\n");
}
async function judgeArtwork(image, item, mode) {
  const imageData = "data:image/webp;base64," + image.toString("base64");
  const response = await callOpenAI("responses", {
    model: opt.judge,
    input: [{
      role: "user",
      content: [
        { type: "input_text", text: judgePrompt(item, mode) },
        { type: "input_image", image_url: imageData, detail: "auto" },
      ],
    }],
    max_output_tokens: 240,
  }, 120000);
  const text = (response.output || []).filter((o) => o.type === "message")
    .flatMap((o) => o.content || []).filter((o) => o.type === "output_text")
    .map((o) => o.text).join("\n");
  if (!text) throw new Error("AI judge did not return a review");
  return parseAssessment(text);
}

await mkdir(path.join(root, "assets", "image-quiz", "ai", opt.mode), { recursive: true });
const report = { mode: opt.mode, imageModel: opt.model, judgeModel: opt.judge,
  attempted: 0, approved: 0, rejected: 0, errors: 0, results: [] };
const manifestAnswers = new Set(manifest.questions.map((r) => r.answer));
for (const candidate of plan) {
  if (manifestAnswers.has(candidate.item.answer)) continue;
  let approved = false;
  for (let attempt = 1; attempt <= opt.attempts; attempt++) {
    report.attempted++;
    try {
      const prompt = candidate.prompt + "\nAttempt " + attempt +
        ": use a distinct original arrangement. No spelling or logos.";
      const image = await createArtwork(prompt);
      const rating = await judgeArtwork(image, candidate.item, opt.mode);
      if (!approveAssessment(rating)) {
        report.rejected++;
        report.results.push({ id: candidate.id, attempt, status: "rejected", review: rating });
        console.log("Rejected " + candidate.id + " (automatic quality gate), attempt " + attempt);
        continue;
      }
      const record = newEntry(opt.mode, candidate.item, candidate.id, opt.model, opt.style, rating);
      const target = path.join(root, ...record.imageUrl.split("/"));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, image);
      manifest.questions.push(record);
      manifestAnswers.add(candidate.item.answer);
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
      approved = true;
      report.approved++;
      report.results.push({ id: candidate.id, attempt, status: "approved", review: rating });
      console.log("APPROVED " + candidate.id + " -> " + record.imageUrl);
      break;
    } catch (e) {
      report.errors++;
      report.results.push({ id: candidate.id, attempt, status: "error", error: e.message });
      console.warn("Error for " + candidate.id + ": " + e.message);
      if (e.rateLimited) {
        await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
        throw new Error("Stopping after an OpenAI rate-limit/server error to avoid repeated charges");
      }
    }
  }
  if (!approved) {
    // Persist failed answer keys across batches, so expensive rejected images
    // are never generated repeatedly just because they were rejected.
    const { normalizeGuess } = await import("../js/games/image-quiz/image-quiz-core.js");
    rejectedAnswers.push(normalizeGuess(candidate.item.answer));
    await writeFile(rejectedPath, JSON.stringify([...new Set(rejectedAnswers)], null, 2) + "\n");
    console.log("No approved image for " + candidate.id + ". This answer will not be retried automatically.");
  }
}
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log("Batch completed: " + JSON.stringify({
  approved: report.approved, rejected: report.rejected, errors: report.errors,
  retainedPublishedImages: manifest.questions.length,
}));
