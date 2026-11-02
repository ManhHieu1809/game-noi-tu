import fs from "node:fs";

const raw = fs.readFileSync("assets/Viet74K.txt", "utf8");
const VOWEL = /[aăâeêioôơuưyàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/u;
const TOKEN = /^[a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+$/u;
const norm = (s) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

const syllables = new Set();
const words = new Map();
for (const line of raw.split(/\r?\n/)) {
  const value = norm(line);
  if (!value) continue;
  const parts = value.split(" ");
  if (parts.length > 8) continue;
  if (!parts.every((p) => p.length <= 9 && TOKEN.test(p) && VOWEL.test(p))) continue;
  for (const p of parts) syllables.add(p);
  if (parts.length >= 2 && parts.length <= 5) words.set(parts.join(" "), 1);
}

const out = [...words.keys()].sort((a, b) => a.localeCompare(b, "vi"));
const syllablesOut = [...syllables].sort((a, b) => a.localeCompare(b, "vi"));
fs.writeFileSync("assets/words.txt", out.join("\n") + "\n");
fs.writeFileSync("assets/syllables.txt", syllablesOut.join("\n") + "\n");
console.log("words:", out.length, "syllables:", syllablesOut.length);
console.log("size words:", fs.statSync("assets/words.txt").size, "size syllables:", fs.statSync("assets/syllables.txt").size);
