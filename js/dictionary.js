let cache = null;

async function fetchLines(path) {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Không tải được ${path} (${response.status}).`);
  }
  const text = await response.text();
  return text
    .split(/\r?\n/)
    .map((line) => line.normalize("NFC").trim())
    .filter(Boolean);
}

export async function loadDictionary(basePath = "assets/") {
  if (cache) return cache;

  let words;
  let syllables;
  try {
    [words, syllables] = await Promise.all([
      fetchLines(`${basePath}words.txt`),
      fetchLines(`${basePath}syllables.txt`),
    ]);
  } catch (error) {
    throw new Error("Không tải được từ điển. Hãy mở trang qua máy chủ tĩnh (không dùng file://).");
  }

  if (!words.length || !syllables.length) {
    throw new Error("Từ điển rỗng hoặc không hợp lệ.");
  }

  cache = {
    words: new Set(words),
    syllables: new Set(syllables),
  };
  return cache;
}
