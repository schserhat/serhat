// Single media tile used in the profile media grid.

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing } from "@/src/lib/theme";
import type { MediaItem } from "@/src/lib/types";

interface Props {
  item: MediaItem;
  downloaded?: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

function fmtDuration(sec?: number | null) {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MediaTile({
  item,
  downloaded,
  selected,
  selectionMode,
  onPress,
  onLongPress,
}: Props) {
  const dur = fmtDuration(item.duration);
  const photoCount = item.images?.length || 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.tile, selected && styles.tileSelected]}
      testID={`media-grid-item-${item.id}`}
    >
      {item.cover ? (
        <Image
          source={{ uri: item.cover }}
          style={styles.img}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      ) : (
        <View style={[styles.img, styles.imgPlaceholder]} />
      )}

      {/* Type badge */}
      <View style={styles.badge}>
        <Ionicons
          name={item.type === "photo" ? "images" : "play"}
          size={11}
          color={colors.text}
        />
        {item.type === "photo" && photoCount > 1 ? (
          <Text style={styles.badgeText}>{photoCount}</Text>
        ) : dur ? (
          <Text style={styles.badgeText}>{dur}</Text>
        ) : null}
      </View>

      {/* Selection checkbox */}
      {selectionMode ? (
        <View
          style={[styles.checkbox, selected && styles.checkboxOn]}
          testID={`media-grid-checkbox-${item.id}`}
        >
          {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </View>
      ) : null}

      {/* Downloaded overlay */}
      {downloaded ? (
        <View style={styles.downloadedOverlay} testID={`media-downloaded-${item.id}`}>
          <View style={styles.downloadedBadge}>
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    aspectRatio: 9 / 16,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileSelected: { borderColor: colors.primary, borderWidth: 2 },
  img: { width: "100%", height: "100%" },
  imgPlaceholder: { backgroundColor: colors.surfaceElev },
  badge: {
    position: "absolute",
    bottom: spacing.xs + 2,
    left: spacing.xs + 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeText: { color: colors.text, fontSize: 10, fontWeight: "700" },
  checkbox: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  downloadedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  downloadedBadge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
    padding: 4,
  },
});
