// Settings tab.

import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { toast } from "@/src/components/Toast";
import { selectors, updateSettings, useStore } from "@/src/lib/store";
import { colors, radius, spacing } from "@/src/lib/theme";

const SAF = FileSystem.StorageAccessFramework;
const CONCURRENCY_OPTIONS = [1, 2, 3, 5, 8] as const;

export default function SettingsScreen() {
  const settings = useStore(selectors.settings);

  async function pickDefaultFolder() {
    if (!SAF) {
      toast("Bu özellik native build sonrası çalışır", "info");
      return;
    }
    try {
      const perm = await SAF.requestDirectoryPermissionsAsync();
      if (!perm.granted) return;
      updateSettings({ defaultFolderUri: perm.directoryUri });
      toast("Varsayılan klasör kaydedildi", "success");
    } catch (e: any) {
      toast(e?.message || "Klasör seçilemedi", "error");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.brand}>Ayarlar</Text>
        </View>

        <Section title="Kalite">
          <Row
            label="HD / Watermark'sız indir"
            description="Aktif olduğunda mümkün olan en yüksek kalitede dosya alınır (1080p ve üzeri)."
            testID="settings-hd-row"
            right={
              <Switch
                value={settings.hd}
                onValueChange={(v) => updateSettings({ hd: v })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
                testID="settings-hd-switch"
              />
            }
          />
        </Section>

        <Section title="Performans">
          <View style={styles.cardPad}>
            <Text style={styles.rowLabel}>Eşzamanlı indirme</Text>
            <Text style={styles.rowDesc}>
              Aynı anda kaç indirme çalışacağını seç. Daha yüksek = daha hızlı toplu indirme.
            </Text>
            <View style={styles.segment}>
              {CONCURRENCY_OPTIONS.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => updateSettings({ concurrency: n })}
                  style={[
                    styles.segItem,
                    settings.concurrency === n && styles.segItemActive,
                  ]}
                  testID={`settings-concurrency-${n}`}
                >
                  <Text
                    style={[
                      styles.segText,
                      settings.concurrency === n && styles.segTextActive,
                    ]}
                  >
                    {n}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Section>

        <Section title="Kayıt Konumu">
          <Row
            label="Varsayılan klasör"
            description={
              settings.defaultFolderUri
                ? "Klasör seçili. Profilinin kendi klasörü yoksa indirmeler buraya gider."
                : "Bir profile özel klasör verilmemişse indirmeler uygulamanın kendi klasörüne kaydedilir."
            }
            right={
              <Pressable onPress={pickDefaultFolder} style={styles.smallBtn} testID="settings-pick-default-folder">
                <Ionicons name="folder-open" size={14} color={colors.text} />
                <Text style={styles.smallBtnText}>
                  {settings.defaultFolderUri ? "Değiştir" : "Seç"}
                </Text>
              </Pressable>
            }
          />
        </Section>

        <Section title="Hakkında">
          <Row
            label="TikDrop"
            description="Kişisel TikTok video ve fotoğraf indirici. SAF ile özel klasör desteği. Çözünürlüğü düşürmez."
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row(props: {
  label: string;
  description?: string;
  right?: React.ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.row} testID={props.testID}>
      <View style={{ flex: 1, paddingRight: spacing.md }}>
        <Text style={styles.rowLabel}>{props.label}</Text>
        {props.description ? <Text style={styles.rowDesc}>{props.description}</Text> : null}
      </View>
      {props.right}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: { paddingTop: spacing.lg },
  brand: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardPad: { padding: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.text, fontWeight: "700", fontSize: 14 },
  rowDesc: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceElev,
    borderRadius: radius.md,
    marginTop: spacing.md,
    padding: 3,
    gap: 3,
  },
  segItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  segItemActive: { backgroundColor: colors.primary },
  segText: { color: colors.muted, fontWeight: "800", fontSize: 13 },
  segTextActive: { color: "#fff" },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surfaceElev,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallBtnText: { color: colors.text, fontWeight: "700", fontSize: 12 },
});
