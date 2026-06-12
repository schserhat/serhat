// Tiny modal/bottom-sheet wrapper. Uses RN Modal so it always sits on top
// of tab bar / FAB without zIndex hacks.

import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/src/lib/theme";

interface Props {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  testID?: string;
}

export default function Sheet({ visible, title, onClose, children, testID }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined}/>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kav}
      >
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          testID={testID}
        >
          <View style={styles.grabber} />
          {title ? (
            <View style={styles.headerRow}>
              <Text style={styles.title} testID={testID ? `${testID}-title` : undefined}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={styles.closeBtn}
                testID={testID ? `${testID}-close-button` : "sheet-close-button"}
              >
                <Text style={styles.closeText}>Kapat</Text>
              </Pressable>
            </View>
          ) : null}
          <View>{children}</View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  closeText: { color: colors.muted, fontSize: 14, fontWeight: "600" },
});
