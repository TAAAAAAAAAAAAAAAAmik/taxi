export const kinetixColors = {
  graphite: "#F4FAF6",
  surface: "#FFFFFF",
  surfaceRaised: "#E8F3EF",
  surfaceLight: "#F8FBFF",
  textPrimary: "#12382C",
  textSecondary: "#557669",
  textMuted: "#789187",
  amber: "#008D49",
  amberPressed: "#006F3A",
  amberBright: "#40C878",
  amberSoft: "rgba(0, 141, 73, 0.16)",
  teal: "#006BB6",
  tealSoft: "rgba(0, 107, 182, 0.12)",
  glass: "rgba(255, 255, 255, 0.88)",
  glassStrong: "rgba(255, 255, 255, 0.96)",
  line: "rgba(0, 141, 73, 0.28)",
  lineStrong: "#008D49",
  success: "#008D49",
  warning: "#E7B416",
  danger: "#FF3B30",
  disabled: "#A9BBB3",
  overlay: "rgba(18, 56, 44, 0.22)",
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
    borderColor: "rgba(0, 141, 73, 0.28)",
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
    background: "#F4FAF6",
    surface: "#FFFFFF",
    textPrimary: "#12382C",
    accent: "#008D49",
    reward: "#E7B416",
    focus: "#006BB6",
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
