import { Platform } from "react-native";

const tintColorLight = "#0A4EA3";
const tintColorDark = "#4DB3FF";

export const Colors = {
  light: {
    text: "#10263F",
    textMuted: "#4C6682",
    textSubtle: "#6D84A0",
    textOnHero: "#E6F0FB",
    background: "#EAF2FA",
    surface: "#FFFFFF",
    surfaceMuted: "#F3F8FD",
    border: "#C9DBEE",
    borderStrong: "#AFC8E2",
    tint: tintColorLight,
    tintPressed: "#083C80",
    accent: "#F6C441",
    accentText: "#182C47",
    icon: "#607B97",
    danger: "#B42318",
    statusLiveBg: "#DFF4E8",
    statusIdleBg: "#EDF2F7",
    statusLiveText: "#157347",
    statusIdleText: "#5C7898",
    tabIconDefault: "#607B97",
    tabIconSelected: tintColorLight,
    heroBackground: "#0B2E59",
    heroOrbOne: "#5BAAF9",
    heroOrbTwo: "#0D4D99",
    shadow: "#08213E",
    tabBarInactive: "#B5CAE0",
    surfaceElevated: "#FFFFFF",
    surfaceGlass: "#E5F0FB",
    ring: "#79B1E8",
    cta: "#0A4EA3",
    ctaPressed: "#083C80",
    ctaText: "#FFFFFF",
    chipActive: "#0E5ABA",
    chipTextOnActive: "#F2F9FF",
  },
  dark: {
    text: "#EAF3FD",
    textMuted: "#B4CCE4",
    textSubtle: "#9AB6CF",
    textOnHero: "#E6F0FB",
    background: "#071526",
    surface: "#0A1D33",
    surfaceMuted: "#102944",
    border: "#1E446A",
    borderStrong: "#28547F",
    tint: tintColorDark,
    tintPressed: "#2B8ED8",
    accent: "#F6C441",
    accentText: "#10263F",
    icon: "#A6C0D9",
    danger: "#F97066",
    statusLiveBg: "#DFF4E8",
    statusIdleBg: "#EDF2F7",
    statusLiveText: "#157347",
    statusIdleText: "#5C7898",
    tabIconDefault: "#A6C0D9",
    tabIconSelected: tintColorDark,
    heroBackground: "#071526",
    heroOrbOne: "#154D86",
    heroOrbTwo: "#0A3156",
    shadow: "#000E1E",
    tabBarInactive: "#B5CAE0",
    surfaceElevated: "#112F4E",
    surfaceGlass: "#163758",
    ring: "#367CB8",
    cta: "#2A89D9",
    ctaPressed: "#1F73BA",
    ctaText: "#FFFFFF",
    chipActive: "#3E9CE1",
    chipTextOnActive: "#041A31",
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
