// Home: paste a TikTok URL → resolves single post OR navigates to profile.
//
// Detects:
//   * Single video / photo post URL → resolves via API, enqueues immediately,
//     and shows a toast.
//   * Profile URL (or "@user" / bare username) → navigates to /profile/[user]
//     so the user can browse and bulk-download.

import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, isSinglePostUrl, parseProfileUrl } from "@/src/lib/api";
import { enqueueMediaItems } from "@/src/lib/downloader";
import { findProfileByUsername, selectors, useStore } from "@/src/lib/store";
import { colors, radius, spacing } from "@/src/lib/theme";
import { toast } from "@/src/components/Toast";

export default function HomeScreen() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const profiles = useStore(selectors.profiles);
  const queueCount = useStore((s) => s.queue.filter((q) => q.status === "downloading" || q.status === "pending").length);

  async function pasteFromClipboard() {
    const text = (await Clipboard.getStringAsync()) || "";
    if (text) setInput(text.trim());
  }

  async function handleGo() {
    const value = input.trim();
    if (!value) {
      toast("Önce bir bağlantı yapıştır", "error");
      return;
    }

    // 1) Single post URL → resolve + enqueue immediately.
    if (isSinglePostUrl(value)) {
      setLoading(true);
      try {
        const media = await api.resolveUrl(value, true);
        // Try to match to a saved profile (so files land in its folder).
        const profile = media.author_unique_id
          ? findProfileByUsername(media.author_unique_id)
          : undefined;
        enqueueMediaItems([media], { profile });
        toast("İndirme kuyruğa eklendi", "success");
        setInput("");
        router.push("/(tabs)/queue");
      } catch (e: any) {
        toast(e?.message || "Bağlantı çözülemedi", "error");
      } finally {
        setLoading(false);
      }
      return;
    }

    // 2) Profile URL / username → open profile screen.
    const username = parseProfileUrl(value);
    if (username) {
      setInput("");
      router.push(`/profile/${username}`);
      return;
    }

    toast("Geçerli bir TikTok bağlantısı bulamadım", "error");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brand} testID="home-brand">TikDrop</Text>
          <Text style={styles.subtitle}>Profil veya tek video bağlantısı yapıştır</Text>
        </View>

        <View style={styles.card} testID="url-input-container">
          <View style={styles.inputRow}>
            <Ionicons name="link" size={18} color={colors.muted} />
            <TextInput
              testID="url-input"
              value={input}
              onChangeText={setInput}
              placeholder="https://www.tiktok.com/@kullanici  ya da  /video/123..."
              placeholderTextColor={colors.mutedDeep}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleGo}
            />
            {input ? (
              <Pressable
                onPress={() => setInput("")}
                hitSlop={10}
                testID="url-clear-button"
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <Pressable
              onPress={pasteFromClipboard}
              style={[styles.btn, styles.btnGhost]}
              testID="url-paste-button"
            >
              <Ionicons name="clipboard" size={16} color={colors.text} />
              <Text style={styles.btnGhostText}>Yapıştır</Text>
            </Pressable>
            <Pressable
              onPress={handleGo}
              disabled={loading}
              style={[styles.btn, styles.btnPrimary, loading && { opacity: 0.6 }]}
              testID="url-go-button"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download" size={16} color="#fff" />
                  <Text style={styles.btnPrimaryText}>İndir / Aç</Text>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.hintRow}>
            <Ionicons name="information-circle-outline" size={14} color={colors.muted} />
            <Text style={styles.hintText}>
              Tek video / fotoğraf bağlantısı kuyruğa eklenir. Profil bağlantısı tüm gönderileri gösterir.
            </Text>
          </View>
        </View>

        {queueCount > 0 ? (
          <Pressable
            onPress={() => router.push("/(tabs)/queue")}
            style={styles.queueStrip}
            testID="home-active-queue-strip"
          >
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.queueStripText}>{queueCount} indirme devam ediyor</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı Kısayollar</Text>
          {profiles.length === 0 ? (
            <View style={styles.empty} testID="home-empty-shortcuts">
              <Ionicons name="bookmark-outline" size={28} color={colors.muted} />
              <Text style={styles.emptyText}>
                Henüz kayıtlı profil yok. Profiller sekmesinden ekleyebilirsin.
              </Text>
            </View>
          ) : (
            <View style={styles.chipsRow}>
              {profiles.slice(0, 6).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/profile/${p.username}`)}
                  style={styles.chip}
                  testID={`home-shortcut-${p.username}`}
                >
                  <Ionicons name="person-circle" size={16} color={colors.primary} />
                  <Text style={styles.chipText} numberOfLines={1}>@{p.username}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.lg },
  brand: { color: colors.text, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElev,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 4,
  },
  actionsRow: { flexDirection: "row", gap: spacing.sm },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.md,
    minHeight: 44,
  },
  btnGhost: {
    flex: 1,
    backgroundColor: colors.surfaceElev,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostText: { color: colors.text, fontWeight: "700", fontSize: 14 },
  btnPrimary: { flex: 2, backgroundColor: colors.primary },
  btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  hintRow: { flexDirection: "row", gap: spacing.xs, alignItems: "flex-start" },
  hintText: { color: colors.muted, fontSize: 12, flex: 1, lineHeight: 16 },
  queueStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  queueStripText: { color: colors.text, flex: 1, fontWeight: "600" },
  section: { marginTop: spacing.xl },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  empty: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    maxWidth: "100%",
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
});
