// Lightweight Toast — avoids RN Alert. Mount once at root.

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/src/lib/theme";

type ToastKind = "info" | "success" | "error";

let _push: ((msg: string, kind?: ToastKind) => void) | null = null;
export function toast(msg: string, kind: ToastKind = "info") {
  _push?.(msg, kind);
}

export default function ToastHost() {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<ToastKind>("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    _push = (m, k = "info") => {
      setMsg(m);
      setKind(k);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
          () => setMsg(null),
        );
      }, 2400);
    };
    return () => {
      _push = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacity]);

  if (!msg) return null;

  const accent =
    kind === "success" ? colors.success : kind === "error" ? colors.error : colors.primary;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { bottom: insets.bottom + 90, opacity }]}
      testID="toast-host"
    >
      <View style={[styles.toast, { borderColor: accent }]}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.text} numberOfLines={2}>
          {msg}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElev,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxWidth: "88%",
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1 },
});
