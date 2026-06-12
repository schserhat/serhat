import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/src/lib/theme";

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home",
  profiles: "people-circle",
  queue: "cloud-download",
  gallery: "albums",
  settings: "settings-sharp",
};

const LABELS: Record<string, string> = {
  index: "Ana Sayfa",
  profiles: "Profiller",
  queue: "Kuyruk",
  gallery: "Galeri",
  settings: "Ayarlar",
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: LABELS[route.name] ?? route.name,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 56 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 2 : 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: Platform.select({ ios: "600", android: "700" }),
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name] ?? "ellipse"} color={color} size={size - 2} />
        ),
      })}
      sceneContainerStyle={{ backgroundColor: colors.bg }}
    >
      <Tabs.Screen name="index" options={{ tabBarTestID: "tab-home" }} />
      <Tabs.Screen name="profiles" options={{ tabBarTestID: "tab-profiles" }} />
      <Tabs.Screen name="queue" options={{ tabBarTestID: "tab-queue" }} />
      <Tabs.Screen name="gallery" options={{ tabBarTestID: "tab-gallery" }} />
      <Tabs.Screen name="settings" options={{ tabBarTestID: "tab-settings" }} />
    </Tabs>
  );
}
