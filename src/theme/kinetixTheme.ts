import { kinetixColors, kinetixRadii, kinetixSpacing, kinetixTouchTargets } from './kinetixTokens';

export const kx = {
  color: kinetixColors,
  radius: kinetixRadii,
  space: kinetixSpacing,
  touch: kinetixTouchTargets,
  border: {
    default: kinetixColors.amber,
    subtle: 'rgba(0, 141, 73, 0.18)',
    reward: kinetixColors.warning,
    muted: 'rgba(18, 56, 44, 0.12)',
  },
  text: {
    primary: kinetixColors.textPrimary,
    secondary: kinetixColors.textSecondary,
    muted: kinetixColors.textMuted,
    inverse: kinetixColors.graphite,
    accent: kinetixColors.amber,
    reward: kinetixColors.amber,
    live: kinetixColors.teal,
  },
  surface: {
    page: kinetixColors.graphite,
    card: kinetixColors.surface,
    raised: kinetixColors.surfaceRaised,
    soft: '#E8F3EF',
    input: kinetixColors.surface,
    selected: kinetixColors.surfaceLight,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.95 }],
  },
} as const;

export const kinetixCommonStyles = {
  page: {
    backgroundColor: kx.surface.page,
    minHeight: '100%' as const,
  },
  card: {
    backgroundColor: kx.surface.card,
    borderColor: kx.border.default,
    borderRadius: kx.radius.card,
    borderWidth: 1,
  },
  raisedCard: {
    backgroundColor: kx.surface.raised,
    borderColor: kx.border.subtle,
    borderRadius: kx.radius.card,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: kx.color.amber,
    borderColor: kx.color.amber,
    borderRadius: kx.radius.control,
    borderWidth: 1,
    minHeight: kx.touch.regular,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: kx.color.amber,
    borderRadius: kx.radius.control,
    borderWidth: 1,
    minHeight: kx.touch.regular,
  },
  input: {
    backgroundColor: kx.surface.input,
    borderColor: kx.color.textSecondary,
    borderRadius: kx.radius.control,
    borderWidth: 1,
    color: kx.color.textPrimary,
    minHeight: kx.touch.regular,
  },
} as const;
