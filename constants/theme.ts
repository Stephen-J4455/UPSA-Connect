import { Platform } from "react-native";

const tintColorLight = "#003366";
const tintColorDark = "#FFCC00";

export const Colors = {
  light: {
    text: "#0B2E50",
    textMuted: "#4A6885",
    textSubtle: "#5C7898",
    textOnHero: "#E6F0FB",
    background: "#EEF4FA",
    surface: "#FFFFFF",
    surfaceMuted: "#F7FAFD",
    border: "#D2E1EE",
    borderStrong: "#B7CDE2",
    tint: tintColorLight,
    tintPressed: "#002244",
    accent: "#FFCC00",
    accentText: "#003366",
    icon: "#587797",
    danger: "#B42318",
    statusLiveBg: "#DFF4E8",
    statusIdleBg: "#EDF2F7",
    statusLiveText: "#157347",
    statusIdleText: "#5C7898",
    tabIconDefault: "#587797",
    tabIconSelected: tintColorLight,
    heroBackground: "#003366",
    heroOrbOne: "#1A4C7E",
    heroOrbTwo: "#0A2F54",
    shadow: "#001A33",
    tabBarInactive: "#B5CAE0",
  },
  dark: {
    text: "#EAF3FD",
    textMuted: "#A7C2DC",
    textSubtle: "#9BB7D1",
    textOnHero: "#E6F0FB",
    background: "#020E1A",
    surface: "#071A2D",
    surfaceMuted: "#082843",
    border: "#184066",
    borderStrong: "#1A4A73",
    tint: tintColorDark,
    tintPressed: "#D9B100",
    accent: "#FFCC00",
    accentText: "#003366",
    icon: "#9BB4CC",
    danger: "#F97066",
    statusLiveBg: "#DFF4E8",
    statusIdleBg: "#EDF2F7",
    statusLiveText: "#157347",
    statusIdleText: "#5C7898",
    tabIconDefault: "#9BB4CC",
    tabIconSelected: tintColorDark,
    heroBackground: "#061A2D",
    heroOrbOne: "#1A4C7E",
    heroOrbTwo: "#0A2F54",
    shadow: "#001A33",
    tabBarInactive: "#B5CAE0",
  },
};

export type ThemeMode = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ThemeMode];

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 28,
  xxxl: 32,
};

export const IconSize = {
  sm: 16,
  md: 20,
  lg: 24,
};

export const FontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  extrabold: "800",
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Shadows = {
  card: {
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
};
