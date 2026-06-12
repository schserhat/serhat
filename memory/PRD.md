# TikDrop — Personal TikTok Downloader

## Vision
A personal Android app for downloading TikTok videos and photo carousels with maximum quality preserved. Built for a single user (not Play Store) running Android 13 / MIUI HyperOS. No accounts, no telemetry, no ads.

## Core flows

1. **Single-link download** — paste a TikTok video / photo post URL → backend resolves it via tikwm.com → file goes straight to the download queue.
2. **Profile shortcuts** — save any TikTok account as a quick shortcut with optional per-profile save folder (Android SAF). Tap a shortcut to open its media list.
3. **Profile media browser** — paginated grid of every post (videos + photo carousels). Each tile shows type badge, duration / image-count, and a downloaded overlay when the post is already saved locally.
4. **Bulk downloads** — three buttons: "Yenileri" (only undownloaded posts), "Hepsi" (everything visible), or multi-select mode with checkboxes and a floating "N İndir" button.
5. **Already-downloaded detection** — when you reopen a profile, the app reads its local downloaded map (per-post id) and dims/checks any post already on disk so you only get the new ones.
6. **Download queue** — parallel downloads (1–8 concurrency, user-tunable) with per-item progress bars, retry on failure, and "clear completed".
7. **Gallery** — per-profile summary of how many posts have been downloaded and when.

## Quality strategy
- We always request `hd=1` from tikwm and pick the `hdplay` URL when available (no watermark, original resolution — typically 1080p, 1440p for accounts that upload at higher quality).
- No re-encoding, no compression, no transformation — the bytes from TikTok's CDN are written as-is. Photo carousels are saved as separate JPEG/WEBP files.

## Storage
- **SAF (Storage Access Framework)**: each profile can pick its own save folder (internal storage, SD card, or any document provider). A global default folder is also available in Settings.
- **Fallback**: when SAF isn't configured (or in Expo Go preview), files land in the app's `documentDirectory/downloads/`.
- **Tracking**: per-profile `downloaded` map stored in AsyncStorage keyed by TikTok post id; this drives the "new only" / "already downloaded" UI.

## Build target
- Android development build / APK (SAF requires native build). The app runs in Expo Go for development, but folder-picking is a no-op there.

## Architecture
- **Frontend**: Expo Router (file-based), React Native, dark UI based on the "Performance Pro" design archetype. State held in a tiny `useSyncExternalStore` store with AsyncStorage persistence. Downloads driven by `expo-file-system`'s legacy API (resumable download + StorageAccessFramework).
- **Backend**: FastAPI proxy in front of `tikwm.com`. Three endpoints — `/api/tt/resolve`, `/api/tt/user/info`, `/api/tt/user/posts` — return a normalized schema so the client never deals with tikwm's raw shape.
- **No database**: profiles, queue, and settings are device-local only. No PII leaves the device.

## Out of scope
- Login / authentication.
- Cloud sync.
- Audio-only / music downloads (tikwm exposes them, but not requested).
- iOS — Android-only target per user request.
