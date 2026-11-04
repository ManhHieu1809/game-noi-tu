// Pure, offline-testable helpers for the optional AI artwork builder.
// This file runs in Node.js only, never in public browser code.
import { normalizeGuess } from "../js/games/image-quiz/image-quiz-core.js";

export const AI_STYLES = ["misdirection", "surreal", "comic"];
export const AI_MODES = ["object", "idiom"];

export function slug(value) {
  const result = String(value ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!result || result.length > 100) throw new Error("ID khong hop le");
  return result;
}

export function artworkId(mode, item, variant = 1) {
  if (!AI_MODES.includes(mode)) throw new Error("Mode khong hop le");
  if (!Number.isInteger(variant) || variant < 1 || variant > 3) throw new Error("Variant khong hop le");
  return "ai-" + mode + "-" + slug(item.id) + "-v" + variant;
}

export function makePrompt(mode, item, style = "misdirection", variant = 1) {
  if (!AI_MODES.includes(mode) || !AI_STYLES.includes(style)) throw new Error("Mode/style khong hop le");
  const answer = String(item.answer || "").trim();
  if (!answer || answer.length > 100) throw new Error("Thieu dap an");
  const styles = {
    misdirection: "clever background distractions and a misleading but fair visual story",
    surreal: "absurd surreal situation, humorous visual coincidences, dreamlike realism",
    comic: "funny expressive 3D comic illustration with playful visual gags",
  };
  const scenes = [
    "an unexpected perspective with funny foreground items",
    "an unusual scenario with witty distractions",
    "a chaotic but visually coherent slapstick sequence",
  ];
  const brief = mode === "object"
    ? "The secret Vietnamese answer is: " + answer + ". Draw the actual object or animal, recognizable after careful inspection, but avoid an obvious product-photo or isolated centered subject. Make it a clever and FAIR guessing puzzle."
    : "The secret Vietnamese idiom/proverb is: " + answer + ". Create a three-panel visual riddle illustrating its figurative meaning with a funny twist. Avoid simply drawing a literal single pictogram.";
  return [
    "Make ONE ORIGINAL landscape 3:2 visual riddle for a Vietnamese multiplayer party game.",
    brief, 
    "Style: " + styles[style] + "; variation: " + scenes[(variant - 1) % scenes.length] + ".",
    "Playful, trollish, clever, slightly deceptive but a single intended solution. All-ages friendly.",
    "The game displays the ENTIRE artwork clearly at the beginning: use intentional composition, NOT crop/blur/mask tricks.",
    "STRICTLY NO written text, numbers, letters, labels, speech bubbles, watermarks, recognizable brand logos or existing famous characters.",
    "Never print the answer. Strong original visual storytelling and high clarity.",
  ].join("\n");
}

export function selectPlan({ mode = "object", questions = [], existing = [], rejectedAnswers = [], limit = 2, variants = 1, style = "misdirection", start = 0 } = {}) {
  if (!AI_MODES.includes(mode) || !AI_STYLES.includes(style)) throw new Error("Mode/style khong hop le");
  if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw new Error("Chi cho phep tao 1-8 anh moi dot");
  if (!Number.isInteger(start) || start < 0) throw new Error("Start khong hop le");
  if (!Number.isInteger(variants) || variants < 1 || variants > 3) throw new Error("Variant khong hop le");
  const doneIds = new Set(existing.map((q) => q.id));
  const doneAnswers = new Set([...existing.map((q) => normalizeGuess(q.answer)), ...rejectedAnswers]);
  const visited = new Set();
  const results = [];
  for (const item of questions.slice(start)) {
    if (!item?.id || !item?.answer) continue;
    const key = normalizeGuess(item.answer);
    if (visited.has(key) || doneAnswers.has(key)) continue;
    visited.add(key);
    for (let v = 1; v <= variants; v++) {
      const id = artworkId(mode, item, v);
      if (doneIds.has(id)) continue;
      results.push({ id, item, variant: v, prompt: makePrompt(mode, item, style, v) });
      if (results.length >= limit) return results;
    }
  }
  return results;
}

export function isWebp(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 100 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
}

export function parseAssessment(raw) {
  const content = String(raw || "").trim().replace(/^`{3}(?:json)?\s*/i,"").replace(/\s*`{3}$/, "");
  const data = JSON.parse(content);
  const keys = ["targetAccuracy", "recognizable", "visualHumor", "fairChallenge"];
  const scores = {};
  for (const key of keys) {
    const value = Number(data[key]);
    if (!Number.isFinite(value) || value < 0 || value > 10) throw new Error("Invalid score " + key);
    scores[key] = value;
  }
  if (typeof data.containsText !== "boolean" || typeof data.unsafe !== "boolean") throw new Error("Invalid review result");
  return { ...scores, containsText: data.containsText, unsafe: data.unsafe, note: String(data.note || "").slice(0, 180) };
}

export function approveAssessment(rating) {
  // Conservative thresholds: do not publish weak or suspicious images.
  return !rating.containsText && !rating.unsafe &&
    rating.targetAccuracy >= 8 &&
    rating.recognizable >= 7 &&
    rating.visualHumor >= 6 &&
    rating.fairChallenge >= 6 &&
    rating.fairChallenge <= 9;
}

export function newEntry(mode, item, id, model, style, evaluation) {
  const file = "assets/image-quiz/ai/" + mode + "/" + id + ".webp";
  return {
    id, answer: item.answer,
    aliases: Array.isArray(item.aliases) ? item.aliases : [],
    category: item.category || (mode === "idiom" ? "Thanh ngu" : "Do vat"),
    difficulty: "hard",
    imageUrl: file,
    emoji: item.emoji || "",
    scene: Array.isArray(item.scene) ? item.scene : [],
    sourceType: "ai",
    attribution: "Original AI generated artwork (" + model + ")",
    aiModel: model,
    aiStyle: style,
    aiReview: evaluation,
    reviewStatus: "auto-approved",
    promptVersion: "troll-v1",
  };
}

// For an existing catalog, AI wins for a given normalized answer and older
// photos stay available for other answers. Never introduce duplicates.
export function prioritizeAi(ai, other) {
  const seen = new Set();
  return [...ai, ...other].filter((q) => {
    const k = normalizeGuess(q.answer);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
