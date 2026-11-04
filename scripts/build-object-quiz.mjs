// Curated Wikimedia photo-bank builder. Run only as a batch job, NOT per game turn.
// npm run build:object-quiz
// Photos must be checked for depiction/attribution before public release.
import { mkdir, writeFile } from "node:fs/promises";
import { OBJECT_QUESTIONS } from "../js/games/image-quiz/objects.js";

const output = new URL("../assets/image-quiz/object-questions.json", import.meta.url);
const limitArg = process.argv.find((v) => v.startsWith("--limit="));
const max = limitArg ? Math.max(0, Number(limitArg.split("=")[1]) || 0) : OBJECT_QUESTIONS.length;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const sleepBetweenRequests = 160;

function stripMarkup(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim().slice(0, 180);
}
const acceptable = (license) =>
  /^(?:CC0|CC BY(?:-SA)?(?: \d+(?:\.\d+)?)?|Public Domain|PD(?:-.+)?)/i.test(license)
  && !/NC|ND/i.test(license);

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "GameNoiTuImageQuiz/1.0 (educational open-source project; https://github.com/ManhHieu1809/game-noi-tu)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}
function filenameFromUrl(url) {
  if (!/^https:\/\/upload\.wikimedia\.org\//.test(url || "")) return null;
  try {
    // Original image URL: .../commons/0/0e/Example_file.jpg (not a thumb)
    const path = new URL(url).pathname.split("/");
    return decodeURIComponent(path[path.length - 1] || "");
  } catch { return null; }
}

const downloaded = [];
const report = { total: OBJECT_QUESTIONS.length, selected: 0, noPhoto: 0, noLicense: 0, failures: 0, byCategory: {} };
for (const item of OBJECT_QUESTIONS.slice(0, max)) {
  if (!item.wiki) continue;
  try {
    const summaryUrl = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(item.wiki.replaceAll(" ", "_"));
    const summary = await getJson(summaryUrl);
    const imageUrl = summary.thumbnail?.source;
    const originalUrl = summary.originalimage?.source;
    const filename = filenameFromUrl(originalUrl);
    if (!imageUrl?.startsWith("https://") || !filename) { report.noPhoto++; continue; }

    // Commons file page metadata provides the actual image-specific license.
    const params = new URLSearchParams({
      action: "query", format: "json", prop: "imageinfo", iiprop: "extmetadata",
      iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|Credit",
      titles: "File:" + filename,
    });
    const metaData = await getJson(COMMONS_API + "?" + params);
    const page = Object.values(metaData.query?.pages || {})[0];
    const ext = page?.imageinfo?.[0]?.extmetadata;
    const license = stripMarkup(ext?.LicenseShortName?.value);
    if (!ext || !acceptable(license)) { report.noLicense++; continue; }
    const author = stripMarkup(ext.Artist?.value || ext.Credit?.value || "Wikimedia Commons contributor");
    const licenseUrl = ext?.LicenseUrl?.value || "";
    const fileUrl = "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(filename.replaceAll(" ", "_"));
    downloaded.push({
      id: item.id, answer: item.answer, aliases: item.aliases || [],
      category: item.category, difficulty: "hard",
      imageUrl, emoji: item.emoji,
      sourceUrl: fileUrl,
      attribution: (author || "Wikimedia Commons contributor") + " • " + license,
      license,
      licenseUrl: /^https:\/\//.test(licenseUrl) ? licenseUrl : "",
      reviewStatus: "verify subject and attribution before publishing",
    });
    report.selected++;
    report.byCategory[item.category] = (report.byCategory[item.category] || 0) + 1;
  } catch (error) {
    report.failures++;
    console.warn("Skipped", item.wiki, String(error?.message || error));
  }
  await delay(sleepBetweenRequests);
}
await mkdir(new URL("../assets/image-quiz/", import.meta.url), { recursive: true });
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), source: "Wikipedia thumbnail and Wikimedia Commons imageinfo", questions: downloaded }, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
if (!downloaded.length) {
  console.warn("No photographs were verified. Retaining visual fallback is intentional; do not claim the photo pack is ready.");
}
