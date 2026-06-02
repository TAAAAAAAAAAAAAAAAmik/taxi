export const kinetixColors = {
  graphite: "#0C0C0C",
  surface: "#1C1C1E",
  surfaceRaised: "#242426",
  surfaceLight: "#F5F5F5",
  textPrimary: "#F5F5F5",
  textSecondary: "#B0B0B0",
  textMuted: "#7A7A7A",
  amber: "#F6C600",
  amberPressed: "#D9AD00",
  amberBright: "#FFE066",
  amberSoft: "rgba(246, 198, 0, 0.22)",
  teal: "#F6C600",
  tealSoft: "rgba(246, 198, 0, 0.18)",
  glass: "rgba(28, 28, 30, 0.72)",
  glassStrong: "rgba(28, 28, 30, 0.9)",
  line: "rgba(246, 198, 0, 0.6)",
  lineStrong: "#F6C600",
  success: "#4CD964",
  warning: "#D4A853",
  danger: "#FF3B30",
  disabled: "#5A544E",
  overlay: "rgba(0, 0, 0, 0.48)",
} as const;

export const kinetixTypography = {
  families: {
    primary: "Inter",
    accent: "Inter",
    iosDisplay: "SF Pro Display",
    iosText: "SF Pro Text",
  },
  weights: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  sizes: {
    caption: 12,
    meta: 14,
    body: 16,
    bodyLarge: 18,
    title: 22,
    headline: 28,
    hero: 34,
    metric: 40,
  },
  lineHeights: {
    caption: 16,
    meta: 20,
    body: 24,
    bodyLarge: 26,
    title: 28,
    headline: 34,
    hero: 40,
    metric: 46,
  },
  largeTextMultiplier: 1.2,
} as const;

export const kinetixSpacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const kinetixRadii = {
  control: 8,
  card: 8,
  sheet: 8,
  mapPin: 999,
} as const;

export const kinetixBorders = {
  hairline: 1,
  active: 2,
  focus: 2,
} as const;

export const kinetixTouchTargets = {
  regular: 56,
  large: 64,
  icon: 48,
  iconLarge: 56,
} as const;

export const kinetixMotion = {
  duration: {
    tap: 120,
    micro: 240,
    screen: 300,
    cardSpring: 350,
    driverAssigned: 400,
    searchPulse: 1200,
  },
  easing: {
    easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    spring: "spring(1, 90, 12, 0)",
  },
  pressScale: 0.95,
  screenOffset: 10,
} as const;

export const kinetixIconography = {
  packageName: "phosphor-react-native",
  strokeWeight: 1.75,
  primaryWeight: "regular",
  filledWeight: "fill",
  sizes: {
    small: 18,
    regular: 24,
    large: 32,
  },
} as const;

export const kinetixComponentTokens = {
  primaryButton: {
    minHeight: kinetixTouchTargets.large,
    borderRadius: kinetixRadii.control,
    backgroundColor: kinetixColors.amber,
    pressedBackgroundColor: kinetixColors.amberPressed,
    textColor: kinetixColors.graphite,
    pressedGlowColor: kinetixColors.amberSoft,
  },
  secondaryButton: {
    minHeight: kinetixTouchTargets.regular,
    borderRadius: kinetixRadii.control,
    backgroundColor: "transparent",
    borderColor: kinetixColors.amber,
    textColor: kinetixColors.textPrimary,
  },
  card: {
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.amber,
    borderWidth: kinetixBorders.hairline,
    borderRadius: kinetixRadii.card,
    shadowOpacity: 0,
  },
  input: {
    minHeight: kinetixTouchTargets.regular,
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.textSecondary,
    borderWidth: kinetixBorders.hairline,
    borderRadius: kinetixRadii.control,
    textColor: kinetixColors.textPrimary,
    placeholderColor: kinetixColors.textSecondary,
  },
  glassAddressPanel: {
    minHeight: 72,
    backgroundColor: kinetixColors.glass,
    borderColor: "rgba(212, 168, 83, 0.72)",
    borderWidth: kinetixBorders.hairline,
    borderRadius: kinetixRadii.sheet,
  },
} as const;

export type KinetixTextMode = "regular" | "large";

export function kinetixFontSize(
  size: number,
  mode: KinetixTextMode = "regular",
): number {
  return mode === "large"
    ? Math.round(size * kinetixTypography.largeTextMultiplier)
    : size;
}

export function kinetixLineHeight(
  lineHeight: number,
  mode: KinetixTextMode = "regular",
): number {
  return mode === "large"
    ? Math.round(lineHeight * kinetixTypography.largeTextMultiplier)
    : lineHeight;
}

export const kinetixA11y = {
  minContrastMode: {
    background: "#000000",
    surface: "#1E1C1A",
    textPrimary: "#F5F0E8",
    accent: "#F0C66F",
    reward: "#F0C66F",
    focus: "#7DB8B3",
  },
  voiceInput: {
    addressFieldMicIcon: "Microphone",
    hint: "Нажмите, чтобы продиктовать адрес",
  },
  targetProfiles: {
    default: kinetixTouchTargets.regular,
    lowVision: kinetixTouchTargets.large,
  },
} as const;
