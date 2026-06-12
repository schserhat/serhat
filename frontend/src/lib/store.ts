// Global app state with persistence to AsyncStorage via @/src/utils/storage.
// Tiny subscriber pattern; React components use `useStore`/`useProfiles` etc.

import { useSyncExternalStore } from "react";

import { storage } from "@/src/utils/storage";

import type {
  AppSettings,
  DownloadedRecord,
  ProfileShortcut,
  QueueItem,
} from "./types";

type State = {
  profiles: ProfileShortcut[];
  queue: QueueItem[];
  settings: AppSettings;
  ready: boolean;
};

const initial: State = {
  profiles: [],
  queue: [],
  settings: { hd: true, concurrency: 3 },
  ready: false,
};

let state: State = initial;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return state;
}

// Module-private snapshot getter for non-React consumers (e.g. download manager).
export function _snapshot(): State {
  return state;
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getSnapshot()),
  );
}

// ---------- Persistence ----------

const KEYS = {
  profiles: "tdl.profiles.v1",
  queue: "tdl.queue.v1",
  settings: "tdl.settings.v1",
} as const;

export async function hydrate() {
  const [p, q, s] = await Promise.all([
    storage.getItem(KEYS.profiles, "[]" as string),
    storage.getItem(KEYS.queue, "[]" as string),
    storage.getItem(KEYS.settings, "" as string),
  ]);
  try {
    state = {
      profiles: p ? JSON.parse(p) : [],
      // On boot, mark any in-flight items as pending so they can be retried.
      queue: (q ? JSON.parse(q) : []).map((item: QueueItem) =>
        item.status === "downloading"
          ? { ...item, status: "pending", progress: 0 }
          : item,
      ),
      settings: s ? JSON.parse(s) : initial.settings,
      ready: true,
    };
  } catch {
    state = { ...initial, ready: true };
  }
  emit();
}

function persist(part: keyof typeof KEYS, value: unknown) {
  void storage.setItem(KEYS[part], JSON.stringify(value));
}

// ---------- Profile actions ----------

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addProfile(p: Omit<ProfileShortcut, "id" | "addedAt" | "downloaded">) {
  const profile: ProfileShortcut = {
    id: uid(),
    addedAt: Date.now(),
    downloaded: {},
    ...p,
  };
  state = { ...state, profiles: [profile, ...state.profiles] };
  persist("profiles", state.profiles);
  emit();
  return profile;
}

export function updateProfile(id: string, patch: Partial<ProfileShortcut>) {
  state = {
    ...state,
    profiles: state.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
  persist("profiles", state.profiles);
  emit();
}

export function deleteProfile(id: string) {
  state = { ...state, profiles: state.profiles.filter((p) => p.id !== id) };
  persist("profiles", state.profiles);
  emit();
}

export function markDownloaded(profileId: string, rec: DownloadedRecord) {
  state = {
    ...state,
    profiles: state.profiles.map((p) =>
      p.id === profileId
        ? { ...p, downloaded: { ...p.downloaded, [rec.id]: rec } }
        : p,
    ),
  };
  persist("profiles", state.profiles);
  emit();
}

export function findProfileByUsername(username: string): ProfileShortcut | undefined {
  const u = username.toLowerCase();
  return state.profiles.find((p) => p.username.toLowerCase() === u);
}

// ---------- Queue actions ----------

export function enqueue(items: Omit<QueueItem, "id" | "status" | "progress" | "addedAt">[]) {
  const now = Date.now();
  const newItems: QueueItem[] = items.map((it) => ({
    ...it,
    id: uid(),
    status: "pending",
    progress: 0,
    addedAt: now,
  }));
  state = { ...state, queue: [...newItems, ...state.queue] };
  persist("queue", state.queue);
  emit();
  return newItems;
}

export function updateQueueItem(id: string, patch: Partial<QueueItem>) {
  state = {
    ...state,
    queue: state.queue.map((q) => (q.id === id ? { ...q, ...patch } : q)),
  };
  persist("queue", state.queue);
  emit();
}

export function removeQueueItem(id: string) {
  state = { ...state, queue: state.queue.filter((q) => q.id !== id) };
  persist("queue", state.queue);
  emit();
}

export function clearCompletedQueue() {
  state = { ...state, queue: state.queue.filter((q) => q.status !== "done") };
  persist("queue", state.queue);
  emit();
}

// ---------- Settings ----------

export function updateSettings(patch: Partial<AppSettings>) {
  state = { ...state, settings: { ...state.settings, ...patch } };
  persist("settings", state.settings);
  emit();
}

// ---------- Selectors ----------

export const selectors = {
  profiles: (s: State) => s.profiles,
  queue: (s: State) => s.queue,
  settings: (s: State) => s.settings,
  ready: (s: State) => s.ready,
};
