// Gallery tab: shows all downloaded posts grouped by profile.

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";

import { selectors, useStore } from "@/src/lib/store";
import { colors, radius, spacing } from "@/src/lib/theme";

interface Row {
  profileId: string;
  username: string;
  nickname?: string;
  avatar?: string;
  count: number;
  lastTitle?: string;
  lastAt: number;
}

export default function GalleryScreen() {
  const router = useRouter();
  const profiles = useStore(selectors.profiles);

  const rows = useMemo<Row[]>(() => {
    return profiles
      .map<Row | null>((p) => {
        const recs = Object.values(p.downloaded);
        if (recs.length === 0) return null;
        const last = recs.reduce((a, b) => (a.savedAt > b.savedAt ? a : b));
        return {
          profileId: p.id,
          username: p.username,
          nickname: p.nickname,
          avatar: p.avatar,
          count: recs.length,
          lastTitle: last.title,
          lastAt: last.savedAt,
        };
      })
      .filter((x): x is Row => x !== null)
      .sort((a, b) => b.lastAt - a.lastAt);
  }, [profiles]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.brand}>Galeri</Text>
        <Text style={styles.subtitle}>{rows.length} profilden indirme</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.profileId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty} testID="gallery-empty">
            <Ionicons name="albums-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyTitle}>Henüz indirme yok</Text>
            <Text style={styles.emptyText}>
              Bir profilden veya tek bağlantıdan indirme yaptığında burada özet göreceksin.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => router.push(`/profile/${item.username}`)}
            testID={`gallery-row-${item.username}`}
          >
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={22} color={colors.muted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.nickname || `@${item.username}`}</Text>
              <Text style={styles.handle}>@{item.username}</Text>
              <Text style={styles.meta}>
                {item.count} gönderi • son: {new Date(item.lastAt).toLocaleDateString("tr-TR")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  brand: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  empty: { paddingTop: spacing.xxl, alignItems: "center", gap: spacing.sm },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", paddingHorizontal: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceElev },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.text, fontWeight: "800", fontSize: 14 },
  handle: { color: colors.muted, fontSize: 12 },
  meta: { color: colors.mutedDeep, fontSize: 11, marginTop: 2 },
});
