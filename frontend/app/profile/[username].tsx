// Profile detail: lists posts for a TikTok username with pagination.
//
// Features:
//   * Auto-resolve user info on mount.
//   * Paginated post fetch (TikWM cursor pagination).
//   * Multi-select mode (toggle from action bar OR long-press a tile).
//   * "Sadece yenileri indir" → enqueues every post not yet in profile.downloaded.
//   * Per-profile save folder via SAF.

import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import MediaTile from "@/src/components/MediaTile";
import { toast } from "@/src/components/Toast";
import { api } from "@/src/lib/api";
import { enqueueMediaItems } from "@/src/lib/downloader";
import {
  addProfile,
  findProfileByUsername,
  selectors,
  updateProfile,
  useStore,
} from "@/src/lib/store";
import { colors, radius, spacing } from "@/src/lib/theme";
import type { MediaItem, ProfileShortcut } from "@/src/lib/types";

const PAGE_SIZE = 30;
const SAF = FileSystem.StorageAccessFramework;

export default function ProfileDetailScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const handle = (Array.isArray(username) ? username[0] : username) || "";

  // We read profiles via selector so updates (e.g. new downloaded ids) rerender.
  const profile = useStore((s) => s.profiles.find((p) => p.username.toLowerCase() === handle.toLowerCase()));
  const settings = useStore(selectors.settings);

  const [info, setInfo] = useState<ProfileShortcut | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState("0");
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const downloadedMap = useMemo(
    () => profile?.downloaded || {},
    [profile?.downloaded],
  );

  // Load user info + first page on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!handle) return;
      try {
        const u = await api.userInfo(handle);
        if (cancelled) return;
        // If not saved yet, persist into store as a transient profile.
        const existing = findProfileByUsername(u.unique_id);
        if (existing) {
          // Refresh metadata.
          updateProfile(existing.id, {
            nickname: u.nickname || existing.nickname,
            avatar: u.avatar || existing.avatar,
          });
        }
        setInfo(
          existing ?? {
            id: "preview",
            username: u.unique_id,
            nickname: u.nickname || undefined,
            avatar: u.avatar || undefined,
            addedAt: Date.now(),
            downloaded: {},
          },
        );
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Profil bilgisi alınamadı");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !handle) return;
    setLoading(true);
    try {
      const res = await api.userPosts(handle, cursor, PAGE_SIZE);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(res.cursor || "");
      setHasMore(res.has_more && !!res.cursor);
    } catch (e: any) {
      setError(e?.message || "Gönderiler alınamadı");
    } finally {
      setLoading(false);
    }
  }, [cursor, handle, hasMore, loading]);

  useEffect(() => {
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  // Helpers ------------------------------------------------------------

  function getOrCreateProfile(): ProfileShortcut {
    let p = findProfileByUsername(handle);
    if (!p) {
      p = addProfile({
        username: handle,
        nickname: info?.nickname,
        avatar: info?.avatar,
      });
    }
    return p;
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(items.map((i) => i.id)));
  }
  function selectNewOnly() {
    setSelected(new Set(items.filter((i) => !downloadedMap[i.id]).map((i) => i.id)));
  }

  function enqueueSelected() {
    const p = getOrCreateProfile();
    const sel = items.filter((i) => selected.has(i.id));
    if (sel.length === 0) {
      toast("Önce içerik seç", "info");
      return;
    }
    const folderUri = p.folderUri || settings.defaultFolderUri;
    enqueueMediaItems(sel, { profile: p, folderUri });
    updateProfile(p.id, { lastSyncedAt: Date.now() });
    toast(`${sel.length} indirme kuyruğa eklendi`, "success");
    setSelected(new Set());
    setSelectionMode(false);
  }

  function enqueueAllNew() {
    const p = getOrCreateProfile();
    const fresh = items.filter((i) => !downloadedMap[i.id]);
    if (fresh.length === 0) {
      toast("Yeni gönderi yok", "info");
      return;
    }
    const folderUri = p.folderUri || settings.defaultFolderUri;
    enqueueMediaItems(fresh, { profile: p, folderUri });
    updateProfile(p.id, { lastSyncedAt: Date.now() });
    toast(`${fresh.length} yeni gönderi kuyruğa eklendi`, "success");
  }

  function enqueueAll() {
    const p = getOrCreateProfile();
    const folderUri = p.folderUri || settings.defaultFolderUri;
    enqueueMediaItems(items, { profile: p, folderUri });
    updateProfile(p.id, { lastSyncedAt: Date.now() });
    toast(`${items.length} gönderi kuyruğa eklendi`, "success");
  }

  async function pickFolder() {
    if (!SAF) {
      toast("Bu özellik native build sonrası çalışır", "info");
      return;
    }
    try {
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm.granted) return;
      const p = getOrCreateProfile();
      updateProfile(p.id, { folderUri: perm.directoryUri });
      toast("Klasör kaydedildi", "success");
    } catch (e: any) {
      toast(e?.message || "Klasör seçilemedi", "error");
    }
  }

  const newCount = useMemo(
    () => items.filter((i) => !downloadedMap[i.id]).length,
    [items, downloadedMap],
  );

  // Render -------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} testID="profile-back-button">
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          @{info?.username || handle}
        </Text>
        <Pressable
          onPress={() => {
            setSelectionMode((v) => !v);
            setSelected(new Set());
          }}
          hitSlop={12}
          testID="profile-selection-toggle"
        >
          <Ionicons
            name={selectionMode ? "close" : "checkbox-outline"}
            size={22}
            color={colors.text}
          />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        numColumns={3}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={{ gap: 2 }}
        ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            {/* Profile header */}
            <View style={styles.headerCard}>
              {info?.avatar ? (
                <Image source={{ uri: info.avatar }} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerAvatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={28} color={colors.muted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.headerName}>{info?.nickname || `@${handle}`}</Text>
                <Text style={styles.headerHandle}>@{info?.username || handle}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    <Text style={styles.metaStrong}>{items.length}</Text> görüldü
                  </Text>
                  <Text style={styles.metaText}>
                    <Text style={[styles.metaStrong, { color: colors.success }]}>
                      {Object.keys(downloadedMap).length}
                    </Text>{" "}
                    indirildi
                  </Text>
                  <Text style={styles.metaText}>
                    <Text style={[styles.metaStrong, { color: colors.primary }]}>{newCount}</Text>{" "}
                    yeni
                  </Text>
                </View>
              </View>
            </View>

            {/* Action row */}
            <View style={styles.actions}>
              <Pressable
                onPress={enqueueAllNew}
                style={[styles.actionBtn, styles.primary]}
                testID="profile-download-new-button"
              >
                <Ionicons name="cloud-download" size={14} color="#fff" />
                <Text style={styles.actionBtnText}>Yenileri ({newCount})</Text>
              </Pressable>
              <Pressable
                onPress={enqueueAll}
                style={[styles.actionBtn, styles.ghost]}
                testID="profile-download-all-button"
              >
                <Ionicons name="download" size={14} color={colors.text} />
                <Text style={styles.ghostText}>Hepsi</Text>
              </Pressable>
              <Pressable
                onPress={pickFolder}
                style={[styles.actionBtn, styles.ghost]}
                testID="profile-pick-folder-button"
              >
                <Ionicons
                  name={profile?.folderUri ? "folder-open" : "folder-outline"}
                  size={14}
                  color={profile?.folderUri ? colors.primary : colors.text}
                />
                <Text style={styles.ghostText}>Klasör</Text>
              </Pressable>
            </View>

            {selectionMode ? (
              <View style={styles.selectBar} testID="profile-selection-bar">
                <Text style={styles.selectText}>{selected.size} seçili</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable onPress={selectNewOnly} hitSlop={8} testID="profile-select-new">
                    <Text style={styles.linkText}>Yenileri seç</Text>
                  </Pressable>
                  <Pressable onPress={selectAll} hitSlop={8} testID="profile-select-all">
                    <Text style={styles.linkText}>Tümünü</Text>
                  </Pressable>
                  <Pressable onPress={() => setSelected(new Set())} hitSlop={8} testID="profile-select-clear">
                    <Text style={styles.linkText}>Temizle</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning" size={14} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          loading ? (
            <View style={{ padding: spacing.lg, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : !hasMore && items.length > 0 ? (
            <Text style={styles.endText}>Hepsi yüklendi</Text>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty} testID="profile-empty">
              <Text style={styles.emptyText}>
                Bu kullanıcının görüntülenebilir bir gönderisi bulunamadı.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <MediaTile
            item={item}
            downloaded={!!downloadedMap[item.id]}
            selected={selected.has(item.id)}
            selectionMode={selectionMode}
            onPress={() => {
              if (selectionMode) toggleSelect(item.id);
              else {
                // Quick single-download.
                const p = getOrCreateProfile();
                const folderUri = p.folderUri || settings.defaultFolderUri;
                enqueueMediaItems([item], { profile: p, folderUri });
                toast("Kuyruğa eklendi", "success");
              }
            }}
            onLongPress={() => {
              if (!selectionMode) {
                setSelectionMode(true);
                setSelected(new Set([item.id]));
              } else {
                toggleSelect(item.id);
              }
            }}
          />
        )}
      />

      {selectionMode && selected.size > 0 ? (
        <Pressable
          onPress={enqueueSelected}
          style={styles.fab}
          testID="profile-download-selected-fab"
        >
          <Ionicons name="cloud-download" size={16} color="#fff" />
          <Text style={styles.fabText}>{selected.size} İndir</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topTitle: { color: colors.text, fontWeight: "800", fontSize: 16, flex: 1 },
  gridContainer: { paddingHorizontal: 0, paddingBottom: 120, gap: 2 },
  headerCard: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  headerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  headerName: { color: colors.text, fontWeight: "900", fontSize: 18 },
  headerHandle: { color: colors.muted, fontSize: 12 },
  metaRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  metaText: { color: colors.muted, fontSize: 12 },
  metaStrong: { color: colors.text, fontWeight: "800" },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flex: 1,
  },
  primary: { backgroundColor: colors.primary },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  actionBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  ghostText: { color: colors.text, fontWeight: "700", fontSize: 12 },
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  selectText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  linkText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  errorText: { color: colors.error, fontSize: 12, flex: 1 },
  endText: {
    textAlign: "center",
    color: colors.muted,
    paddingVertical: spacing.lg,
    fontSize: 12,
  },
  empty: { padding: spacing.xxl, alignItems: "center" },
  emptyText: { color: colors.muted, textAlign: "center" },
  fab: {
    position: "absolute",
    bottom: spacing.lg + 60,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.pill,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { color: "#fff", fontWeight: "900", fontSize: 14 },
});
