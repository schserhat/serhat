// Download manager: runs the queue with limited concurrency.
//
// Strategy:
//   * Each queue item points to one or more remote URLs (video file, or
//     N images for a photo carousel).
//   * We download each URL into the app cache via FileSystem.downloadAsync
//     for accurate progress reporting.
//   * If the queue item has a SAF folderUri, we then move the bytes into
//     that directory using StorageAccessFramework. Otherwise we just keep
//     the cache file (good enough for Expo Go preview).
//   * When all parts of the item finish, mark the profile post as
//     downloaded so the grid shows the green check overlay.

import * as FileSystem from "expo-file-system/legacy";

import {
  _snapshot,
  enqueue,
  markDownloaded,
  updateQueueItem,
} from "./store";
import type { MediaItem, ProfileShortcut, QueueItem } from "./types";

const SAF = FileSystem.StorageAccessFramework;

let running = 0;
let tickScheduled = false;

function safeName(s: string): string {
  return s.replace(/[^A-Za-z0-9_.-]+/g, "_").slice(0, 80) || "file";
}

function inferExt(url: string, fallback: string): string {
  const m = /\.([a-zA-Z0-9]{2,5})(?:\?|$)/.exec(url);
  return m ? m[1].toLowerCase() : fallback;
}

function mimeFor(ext: string): string {
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

async function downloadOne(
  url: string,
  baseName: string,
  folderUri: string | undefined,
  onProgress: (p: number) => void,
): Promise<string> {
  const ext = inferExt(url, url.includes("/photo") ? "jpg" : "mp4");
  const fileName = `${baseName}.${ext}`;
  const tmpUri = `${FileSystem.cacheDirectory}${Date.now()}_${fileName}`;

  const resumable = FileSystem.createDownloadResumable(
    url,
    tmpUri,
    {},
    (d) => {
      if (d.totalBytesExpectedToWrite > 0) {
        onProgress(d.totalBytesWritten / d.totalBytesExpectedToWrite);
      }
    },
  );
  const result = await resumable.downloadAsync();
  if (!result) throw new Error("download cancelled");

  // If SAF folder is configured, copy bytes into that folder.
  if (folderUri && SAF) {
    try {
      const destUri = await SAF.createFileAsync(folderUri, fileName, mimeFor(ext));
      const data = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(destUri, data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // Best-effort cleanup of the temp file.
      void FileSystem.deleteAsync(result.uri, { idempotent: true });
      return destUri;
    } catch (e) {
      // Fallback: keep the local cache copy if SAF write fails.
      console.warn("SAF write failed, keeping cache copy:", e);
      return result.uri;
    }
  }

  // No SAF dir → move into a stable per-app folder.
  const dest = `${FileSystem.documentDirectory}downloads/`;
  await FileSystem.makeDirectoryAsync(dest, { intermediates: true }).catch(() => {});
  const finalUri = `${dest}${fileName}`;
  try {
    await FileSystem.moveAsync({ from: result.uri, to: finalUri });
    return finalUri;
  } catch {
    return result.uri;
  }
}

async function processItem(item: QueueItem) {
  updateQueueItem(item.id, { status: "downloading", progress: 0 });
  try {
    const saved: string[] = [];
    const total = item.urls.length;
    for (let i = 0; i < total; i++) {
      const url = item.urls[i];
      const base = `${item.username || "tiktok"}_${item.postId}${total > 1 ? `_${i + 1}` : ""}`;
      const uri = await downloadOne(
        url,
        safeName(base),
        item.folderUri,
        (p) => {
          // Combine per-file progress with overall progress.
          const overall = (i + p) / total;
          updateQueueItem(item.id, { progress: overall });
        },
      );
      saved.push(uri);
    }
    updateQueueItem(item.id, {
      status: "done",
      progress: 1,
      savedFiles: saved,
    });
    if (item.profileId) {
      markDownloaded(item.profileId, {
        id: item.postId,
        type: item.type,
        files: saved,
        savedAt: Date.now(),
        title: item.title,
      });
    }
  } catch (e: any) {
    updateQueueItem(item.id, {
      status: "error",
      error: String(e?.message || e),
    });
  }
}

function tick() {
  tickScheduled = false;
  const state = _snapshot();
  const concurrency = Math.max(1, state.settings.concurrency || 3);
  const pending = state.queue.filter((q) => q.status === "pending");
  while (running < concurrency && pending.length) {
    const next = pending.shift()!;
    running += 1;
    void processItem(next).finally(() => {
      running = Math.max(0, running - 1);
      scheduleTick();
    });
  }
}

export function scheduleTick() {
  if (tickScheduled) return;
  tickScheduled = true;
  setTimeout(tick, 0);
}

// ---------- Public helpers used by screens ----------

export interface EnqueueOptions {
  profile?: ProfileShortcut;
  folderUri?: string;
}

export function enqueueMediaItems(items: MediaItem[], opts: EnqueueOptions = {}) {
  const folderUri = opts.folderUri ?? opts.profile?.folderUri;
  const username = opts.profile?.username;
  const queueRows = items.map((m) => ({
    profileId: opts.profile?.id,
    username,
    postId: m.id,
    type: m.type,
    title: m.title || undefined,
    cover: m.cover || undefined,
    urls:
      m.type === "photo"
        ? (m.images || []).slice()
        : [m.play || m.play_sd || m.wmplay || ""].filter(Boolean),
    folderUri,
  }));
  const created = enqueue(queueRows);
  scheduleTick();
  return created;
}
