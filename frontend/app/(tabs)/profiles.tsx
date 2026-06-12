// Profiles tab: saved shortcuts with per-profile save folder, last sync time,
// and an "Add shortcut" sheet that does a live username preview.

import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import Sheet from "@/src/components/Sheet";
import { toast } from "@/src/components/Toast";
import { api, parseProfileUrl } from "@/src/lib/api";
import {
  addProfile,
  deleteProfile,
  findProfileByUsername,
  selectors,
  updateProfile,
  useStore,
} from "@/src/lib/store";
import { colors, radius, spacing } from "@/src/lib/theme";

const SAF = FileSystem.StorageAccessFramework;

export default function ProfilesScreen() {
  const router = useRouter();
  const profiles = useStore(selectors.profiles);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<null | {
    username: string;
    nickname?: string | null;
    avatar?: string | null;
  }>(null);

  async function lookupPreview(value: string) {
    const u = parseProfileUrl(value);
    if (!u) {
      setPreview(null);
      return;
    }
    try {
      setLoading(true);
      const info = await api.userInfo(u);
      setPreview({ username: info.unique_id, nickname: info.nickname, avatar: info.avatar });
    } catch {
      setPreview({ username: u });
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!preview) return;
    if (findProfileByUsername(preview.username)) {
      toast("Bu profil zaten kayıtlı", "info");
      setSheetOpen(false);
      return;
    }
    addProfile({
      username: preview.username,
      nickname: preview.nickname || undefined,
      avatar: preview.avatar || undefined,
    });
    toast(`@${preview.username} eklendi`, "success");
    setSheetOpen(false);
    setInput("");
    setPreview(null);
  }

  async function pickFolder(profileId: string) {
    if (!SAF) {
      toast("Bu özellik native build sonrası çalışır", "info");
      return;
    }
    try {
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm.granted) return;
      updateProfile(profileId, { folderUri: perm.directoryUri });
      toast("Klasör kaydedildi", "success");
    } catch (e: any) {
      toast(e?.message || "Klasör seçilemedi", "error");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Profiller</Text>
          <Text style={styles.subtitle}>{profiles.length} kayıtlı kısayol</Text>
        </View>
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={styles.addBtn}
          testID="profiles-add-button"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Ekle</Text>
        </Pressable>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={(it) => it.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty} testID="profiles-empty">
            <Ionicons name="people-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyTitle}>Henüz profil eklenmedi</Text>
            <Text style={styles.emptyText}>
              Hızlıca toplu indirmek istediğin TikTok hesaplarını ekle. Her profile özel kayıt klasörü tanımlayabilirsin.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const downloadedCount = Object.keys(item.downloaded).length;
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/profile/${item.username}`)}
              onLongPress={() => {
                deleteProfile(item.id);
                toast(`@${item.username} silindi`, "info");
              }}
              testID={`profile-shortcut-card-${item.username}`}
            >
              {item.avatar ? (
                <Image source={{ uri: item.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={28} color={colors.muted} />
                </View>
              )}
              <Text style={styles.name} numberOfLines={1}>
                {item.nickname || `@${item.username}`}
              </Text>
              <Text style={styles.handle} numberOfLines={1}>@{item.username}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Ionicons name="cloud-done" size={11} color={colors.success} />
                  <Text style={styles.metaText}>{downloadedCount}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons
                    name={item.folderUri ? "folder-open" : "folder-outline"}
                    size={11}
                    color={item.folderUri ? colors.primary : colors.muted}
                  />
                  <Text style={[styles.metaText, !item.folderUri && { color: colors.muted }]}>
                    {item.folderUri ? "Klasör" : "Klasör seç"}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => pickFolder(item.id)}
                style={styles.folderBtn}
                testID={`profile-folder-button-${item.username}`}
              >
                <Ionicons name="folder" size={13} color={colors.text} />
                <Text style={styles.folderBtnText}>
                  {item.folderUri ? "Klasörü Değiştir" : "Kayıt Klasörü"}
                </Text>
              </Pressable>
            </Pressable>
          );
        }}
      />

      <Sheet
        visible={sheetOpen}
        title="Profil Ekle"
        onClose={() => {
          setSheetOpen(false);
          setInput("");
          setPreview(null);
        }}
        testID="add-profile-sheet"
      >
        <View style={styles.sheetBody}>
          <Text style={styles.label}>TikTok kullanıcı adı veya profil bağlantısı</Text>
          <TextInput
            value={input}
            onChangeText={(v) => {
              setInput(v);
              setPreview(null);
            }}
            onBlur={() => lookupPreview(input)}
            onSubmitEditing={() => lookupPreview(input)}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="@kullanici  ya da  https://tiktok.com/@kullanici"
            placeholderTextColor={colors.mutedDeep}
            style={styles.sheetInput}
            testID="add-profile-input"
          />

          {loading ? (
            <View style={{ padding: spacing.md, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : preview ? (
            <View style={styles.previewBox} testID="add-profile-preview">
              {preview.avatar ? (
                <Image source={{ uri: preview.avatar }} style={styles.previewAvatar} />
              ) : (
                <View style={[styles.previewAvatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={22} color={colors.muted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.previewName}>{preview.nickname || `@${preview.username}`}</Text>
                <Text style={styles.previewHandle}>@{preview.username}</Text>
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable
              onPress={() => lookupPreview(input)}
              style={[styles.sheetBtn, styles.sheetBtnGhost]}
              testID="add-profile-preview-button"
            >
              <Text style={styles.sheetBtnGhostText}>Önizle</Text>
            </Pressable>
            <Pressable
              onPress={handleAdd}
              disabled={!preview}
              style={[styles.sheetBtn, styles.sheetBtnPrimary, !preview && { opacity: 0.4 }]}
              testID="add-profile-save-button"
            >
              <Text style={styles.sheetBtnPrimaryText}>Kaydet</Text>
            </Pressable>
          </View>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: {
    paddingTop: spacing.xxl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", paddingHorizontal: spacing.lg, lineHeight: 18 },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceElev },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.text, fontWeight: "800", marginTop: spacing.sm, fontSize: 14 },
  handle: { color: colors.muted, fontSize: 12 },
  metaRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: colors.text, fontSize: 11, fontWeight: "600" },
  folderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.surfaceElev,
    borderRadius: radius.md,
    paddingVertical: 8,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  folderBtnText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  // Sheet styles
  sheetBody: { paddingBottom: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  sheetInput: {
    backgroundColor: colors.surfaceElev,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceElev,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface },
  previewName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  previewHandle: { color: colors.muted, fontSize: 12 },
  sheetBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnGhost: {
    backgroundColor: colors.surfaceElev,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetBtnGhostText: { color: colors.text, fontWeight: "700" },
  sheetBtnPrimary: { backgroundColor: colors.primary },
  sheetBtnPrimaryText: { color: "#fff", fontWeight: "800" },
});
