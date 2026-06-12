// Shared types for the TikTok downloader app.

export type MediaType = "video" | "photo";

export interface MediaItem {
  id: string;
  type: MediaType;
  title?: string | null;
  cover?: string | null;
  duration?: number | null;
  create_time?: number | null;
  play?: string | null;       // HD playback URL (videos only)
  play_sd?: string | null;
  wmplay?: string | null;
  size?: number | null;
  images?: string[] | null;   // For photo posts (carousels)
  author_id?: string | null;
  author_unique_id?: string | null;
}

export interface UserInfo {
  unique_id: string;
  nickname?: string | null;
  avatar?: string | null;
  signature?: string | null;
  follower_count?: number | null;
  video_count?: number | null;
  verified?: boolean | null;
}

export interface ProfileShortcut {
  id: string;            // local id (uuid-ish)
  username: string;      // lowercase, no @
  nickname?: string;
  avatar?: string;
  folderUri?: string;    // SAF content:// URI for save dir, optional
  addedAt: number;
  // Map of TikTok post id -> downloaded record
  downloaded: Record<string, DownloadedRecord>;
  lastSyncedAt?: number;
}

export interface DownloadedRecord {
  id: string;             // post id
  type: MediaType;
  files: string[];        // saved file URIs (multiple for photo carousels)
  savedAt: number;
  title?: string;
}

export type QueueStatus = "pending" | "downloading" | "done" | "error";

export interface QueueItem {
  id: string;             // queue uuid
  profileId?: string;     // profile shortcut id (optional for single-link downloads)
  username?: string;      // for display
  postId: string;         // TikTok post id
  type: MediaType;
  title?: string;
  cover?: string;
  cover_local?: string;   // not used now
  // For video: single URL. For photo: multiple image URLs.
  urls: string[];
  folderUri?: string;     // SAF directory uri; if empty, falls back to app docs
  status: QueueStatus;
  progress: number;       // 0..1
  error?: string;
  savedFiles?: string[];
  addedAt: number;
}

export interface AppSettings {
  hd: boolean;
  concurrency: number;
  defaultFolderUri?: string;
}
