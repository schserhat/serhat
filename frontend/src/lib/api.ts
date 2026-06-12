// API client: talks to our FastAPI backend which proxies tikwm.com.
import type { MediaItem, UserInfo } from "./types";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BASE) {
  // Fail fast — config error.
  console.warn("EXPO_PUBLIC_BACKEND_URL is not set");
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {}
    throw new Error(`API ${res.status}: ${detail}`);
  }
  return (await res.json()) as T;
}

export const api = {
  resolveUrl: (url: string, hd = true) =>
    jsonFetch<MediaItem>("/api/tt/resolve", {
      method: "POST",
      body: JSON.stringify({ url, hd }),
    }),

  userInfo: (uniqueId: string) =>
    jsonFetch<UserInfo>(`/api/tt/user/info?unique_id=${encodeURIComponent(uniqueId)}`),

  userPosts: (uniqueId: string, cursor = "0", count = 30) =>
    jsonFetch<{ items: MediaItem[]; cursor: string; has_more: boolean }>(
      `/api/tt/user/posts?unique_id=${encodeURIComponent(uniqueId)}&cursor=${encodeURIComponent(cursor)}&count=${count}`,
    ),
};

/**
 * Try to extract a TikTok username from a profile URL.
 * Returns null when it's not a profile URL.
 */
export function parseProfileUrl(input: string): string | null {
  const trimmed = input.trim();
  // @user form
  const at = /^@([A-Za-z0-9_.]+)$/.exec(trimmed);
  if (at) return at[1];
  // Bare username
  const bare = /^[A-Za-z0-9_.]+$/.exec(trimmed);
  if (bare) return trimmed;
  // tiktok.com URLs
  const m = /tiktok\.com\/@([A-Za-z0-9_.]+)(?:\/?$|\?|\#)/.exec(trimmed);
  if (m) return m[1];
  return null;
}

export function isSinglePostUrl(input: string): boolean {
  const t = input.trim();
  return /\/video\/\d+/.test(t) || /\/photo\/\d+/.test(t) || /vm\.tiktok\.com/.test(t) || /vt\.tiktok\.com/.test(t) || /tiktok\.com\/t\//.test(t);
}
