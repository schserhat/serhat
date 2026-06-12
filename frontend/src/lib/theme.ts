// Centralized design tokens — keeps screens consistent.
// Matches /app/design_guidelines.json (Performance Pro / Deep Obsidian palette).

export const colors = {
  bg: "#0A0A0A",
  surface: "#141414",
  surfaceElev: "#1E1E1E",
  primary: "#007AFF",
  primaryHover: "#3B82F6",
  text: "#FFFFFF",
  muted: "#A1A1AA",
  mutedDeep: "#71717A",
  border: "#27272A",
  borderStrong: "#3F3F46",
  success: "#10B981",
  error: "#EF4444",
  warn: "#F59E0B",
  overlay: "rgba(0,0,0,0.6)",
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const font = {
  // System font with weight variations — design uses Manrope/Inter but we
  // skip custom font loading to keep the bundle lean. Weights still render
  // bold/black via the system family on iOS/Android.
  family: undefined as undefined,
};
