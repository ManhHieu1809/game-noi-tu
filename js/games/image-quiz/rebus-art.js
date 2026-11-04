// A reusable, original "meme comic" illustration rendered entirely in DOM/CSS.
// Puzzles are visual riddles: they never include text matching the answer.
const REACTIONS = ["ỦA?!", "HẢ?", "??!", "Ơ KÌA", "HUHU", "QUÁI LẠ", "!!!", "HƠI LẠ"];
const SHAPES = ["💥", "💫", "⁉️", "✨", "❗", "🌀"];
function hashCode(value) {
  let h = 2166136261;
  for (const ch of String(value)) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
}
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

export function renderRebusArt(root, scene, questionId) {
  root.replaceChildren();
  if (!Array.isArray(scene) || !scene.length) return false;
  const board = element("div", "rebus-art");
  board.setAttribute("role", "img");
  board.setAttribute("aria-label", "Tranh đố mẹo gồm " + scene.length + " khung. Hãy đoán ý nghĩa của cả bức tranh.");
  const seed = hashCode(questionId);
  const ribbon = element("div", "rebus-art__ribbon", "BỨC TRANH BẤT ỔN 🤡");
  board.appendChild(ribbon);
  const stage = element("div", "rebus-art__stage");
  scene.forEach((icons, index) => {
    const tile = element("div", "rebus-art__tile rebus-art__tile--" + (index % 3));
    tile.style.setProperty("--twist", ([-4, 3, -2, 4, -3, 2][(seed + index) % 6]) + "deg");
    tile.appendChild(element("span", "rebus-art__badge", String(index + 1).padStart(2, "0")));
    tile.appendChild(element("span", "rebus-art__visual", icons));
    tile.appendChild(element("span", "rebus-art__reaction", REACTIONS[(seed + index * 3) % REACTIONS.length]));
    tile.appendChild(element("span", "rebus-art__spark", SHAPES[(seed + index) % SHAPES.length]));
    stage.appendChild(tile);
    if (index < scene.length - 1) stage.appendChild(element("span", "rebus-art__divider", "✦"));
  });
  board.appendChild(stage);
  board.appendChild(element("div", "rebus-art__footer", "ĐỪNG ĐOÁN TÊN ĐỒ VẬT • HÃY ĐOÁN Ý CẢ TRANH"));
  root.appendChild(board);
  return true;
}
