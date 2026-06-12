// Queue tab: shows pending / downloading / done / errored items with progress.

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { toast } from "@/src/components/Toast";
import {
  clearCompletedQueue,
  removeQueueItem,
  selectors,
  updateQueueItem,
  useStore,
} from "@/src/lib/store";
import { scheduleTick } from "@/src/lib/downloader";
import { colors, radius, spacing } from "@/src/lib/theme";

const STATUS_LABEL: Record<string, string> = {
  pending: "Sırada",
  downloading: "İniyor",
  done: "Tamamlandı",
  error: "Hata",
};

const STATUS_COLOR: Record<string, string> = {
  pending: colors.muted,
  downloading: colors.primary,
  done: colors.success,
  error: colors.error,
};

export default function QueueScreen() {
  const queue = useStore(selectors.queue);
  const stats = {
    pending: queue.filter((q) => q.status === "pending").length,
    downloading: queue.filter((q) => q.status === "downloading").length,
    done: queue.filter((q) => q.status === "done").length,
    error: queue.filter((q) => q.status === "error").length,
  };

  function retry(id: string) {
    updateQueueItem(id, { status: "pending", progress: 0, error: undefined });
    scheduleTick();
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Kuyruk</Text>
          <Text style={styles.subtitle}>
            {stats.downloading} aktif • {stats.pending} bekliyor • {stats.done} tamam
          </Text>
        </View>
        <Pressable
          onPress={() => {
            clearCompletedQueue();
            toast("Tamamlananlar temizlendi", "info");
          }}
          style={styles.clearBtn}
          testID="queue-clear-button"
        >
          <Ionicons name="trash-bin" size={14} color={colors.muted} />
          <Text style={styles.clearBtnText}>Temizle</Text>
        </Pressable>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty} testID="queue-empty">
            <Ionicons name="cloud-offline-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyTitle}>Kuyruk boş</Text>
            <Text style={styles.emptyText}>
              Ana sayfadan bağlantı yapıştırarak veya bir profilden indirme başlatabilirsin.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row} testID={`queue-item-${item.id}`}>
            {item.cover ? (
              <Image source={{ uri: item.cover }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: colors.surfaceElev }]} />
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title || `${item.type === "photo" ? "Fotoğraf" : "Video"} • ${item.postId}`}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.username ? `@${item.username}` : "tek bağlantı"} • {item.urls.length} dosya
              </Text>

              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round(item.progress * 100)}%`,
                      backgroundColor: STATUS_COLOR[item.status],
                    },
                  ]}
                />
              </View>
              <View style={styles.bottomRow}>
                <View style={[styles.pill, { borderColor: STATUS_COLOR[item.status] }]}>
                  <Text style={[styles.pillText, { color: STATUS_COLOR[item.status] }]}>
                    {STATUS_LABEL[item.status]}{item.status === "downloading" ? ` ${Math.round(item.progress * 100)}%` : ""}
                  </Text>
                </View>
                {item.status === "error" ? (
                  <Pressable onPress={() => retry(item.id)} hitSlop={8} testID={`queue-retry-${item.id}`}>
                    <Text style={styles.actionText}>Tekrar dene</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => removeQueueItem(item.id)} hitSlop={8} testID={`queue-remove-${item.id}`}>
                  <Ionicons name="close" size={16} color={colors.muted} />
                </Pressable>
              </View>
              {item.error ? <Text style={styles.errorText}>{item.error}</Text> : null}
            </View>
          </View>
        )}
      />
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
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  clearBtnText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { paddingTop: spacing.xxl, alignItems: "center", gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", paddingHorizontal: spacing.lg },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  thumb: { width: 56, height: 80, borderRadius: radius.sm },
  title: { color: colors.text, fontWeight: "700", fontSize: 13 },
  meta: { color: colors.muted, fontSize: 11 },
  barTrack: {
    marginTop: 6,
    height: 6,
    width: "100%",
    backgroundColor: colors.surfaceElev,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: "100%" },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 4 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  pillText: { fontSize: 10, fontWeight: "700" },
  actionText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  errorText: { color: colors.error, fontSize: 11, marginTop: 2 },
});
