# Image Quiz (review branch)

This feature adds **Nhìn hình đoán chữ** without replacing the existing Nối từ / Đôi chữ cái modes. All players guess simultaneously, receive points based on speed, and the answer is revealed at the end of each round. Only the host validates guesses and keeps answer keys; the public game state omits the answer until reveal.

## Start

```sh
npm start
npm test
```

Open http://localhost:3000 in two browsers, create a room, choose *Nhìn hình đoán chữ*, start, and guess. The included 120+ reviewed Vietnamese prompts use emoji as an **offline playable fallback**, not a claim of 120 photographic assets. When a Wikimedia photo bank is built, real photos take priority.

## Add Wikimedia Commons photos

```sh
node scripts/build-image-quiz.mjs
```

The importer reads reviewed Vietnamese answer names and article-title hints in `js/games/image-quiz/seed.js`, queries Wikipedia's public page summary API for a thumbnail, and emits `assets/image-quiz/questions.json`. A network connection is required. It does **not** automatically certify license/attribution: review each sourced item's linked page and license before publishing externally. If a fetch fails, it skips that item, reports counts and leaves the local emoji fallback available. As seed items are curated and added, the bank grows. For large-scale use, run a separate batch curation/metadata pipeline and serve resized images from your own licensed CDN.

The script limits requests and skips items with missing thumbnails. A photo URL only appears when positively returned by the source; no fabricated image URLs are used. Photos are not stored in Git, and browser privacy/connection may block remote sources.

## Anti-repeat

The host stores seen question IDs in localStorage under `noitu.imageQuiz.seen.v1`. The quiz prioritizes unseen question IDs for future sessions, falling back to old ones when the pool is exhausted. This history is **device-specific** rather than user-account-specific.

## Limits / review checklist

- The initial pack has emoji illustrations; Wikimedia photo generation is opt-in and needs online access and license review.
- Because the existing architecture uses client-side P2P hosting, a sufficiently technical participant can inspect public assets directly. A secure, tamper-resistant competition would require a server-side question bank.
- Closing the host's tab ends the room, as in the existing game.
- Check mobile appearance, timers, browser refresh, multiplayer, photo loading, and photo license/attribution before deployment.
