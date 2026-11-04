const loading = document.getElementById("islandLoading");
const fatal = document.getElementById("fatalOverlay");
const fatalText = document.getElementById("fatalText");
const fatalReload = document.getElementById("fatalReloadBtn");

function showFatal(message) {
  fatalText.textContent = message;
  fatal.classList.remove("hidden");
  loading.classList.add("is-done");
}

fatalReload.addEventListener("click", () => location.reload());

import("./main.js")
  .then((mod) => {
    if (mod.startIsland) mod.startIsland();
    loading.classList.add("is-done");
  })
  .catch((err) => {
    console.error("Failed to load island main:", err);
    showFatal("Không thể tải module game 3D. " + (err.message || ""));
  });
