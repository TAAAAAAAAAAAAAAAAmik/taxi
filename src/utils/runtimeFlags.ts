const bundledPublicEnv: Record<string, string | undefined> = {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_ENABLE_DEMO: process.env.EXPO_PUBLIC_ENABLE_DEMO,
  EXPO_PUBLIC_LINKS_DOMAIN: process.env.EXPO_PUBLIC_LINKS_DOMAIN,
  EXPO_PUBLIC_MESSAGE_SERVER_URL: process.env.EXPO_PUBLIC_MESSAGE_SERVER_URL,
  EXPO_PUBLIC_REVERSE_GEOCODE_URL: process.env.EXPO_PUBLIC_REVERSE_GEOCODE_URL,
  EXPO_PUBLIC_SKIP_PHONE_VERIFICATION: process.env.EXPO_PUBLIC_SKIP_PHONE_VERIFICATION,
  EXPO_PUBLIC_WEB_BASE_PATH: process.env.EXPO_PUBLIC_WEB_BASE_PATH,
  NODE_ENV: process.env.NODE_ENV,
};

export function getPublicEnv(key: string) {
  const env = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return env.process?.env?.[key] ?? bundledPublicEnv[key];
}

export function isExamplePublicValue(value: string | undefined) {
  return /example\.(com|net|org|test)/i.test(String(value || ''));
}

export function isLocalPublicValue(value: string | undefined) {
  return /(^|\/\/|\s)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|\s|$)/i.test(
    String(value || ''),
  );
}

export function isReleaseUnsafePublicValue(value: string | undefined) {
  return isExamplePublicValue(value) || isLocalPublicValue(value) || /<[^>]+>/.test(String(value || ''));
}

export function normalizePublicOrigin(value: string | undefined) {
  const trimmedValue = String(value || '').trim().replace(/\/+$/, '');

  if (!trimmedValue || isExamplePublicValue(trimmedValue)) {
    return '';
  }

  return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
}

export function isProductionApp() {
  const appEnv = String(getPublicEnv('EXPO_PUBLIC_APP_ENV') || '').trim().toLowerCase();
  const nodeEnv = String(getPublicEnv('NODE_ENV') || '').trim().toLowerCase();

  if (appEnv) {
    return appEnv === 'production';
  }

  return nodeEnv === 'production';
}

export function isDemoModeEnabled() {
  const value = String(getPublicEnv('EXPO_PUBLIC_ENABLE_DEMO') || '').trim().toLowerCase();

  if (value === 'false' || value === '0') {
    return false;
  }

  if (['1', 'true', 'yes'].includes(value)) {
    return true;
  }

  return !isProductionApp() || isHostedDemoPage();
}

export function isPhoneVerificationSkipped() {
  const value = String(getPublicEnv('EXPO_PUBLIC_SKIP_PHONE_VERIFICATION') || '').trim().toLowerCase();

  return !isProductionApp() && ['1', 'true', 'yes'].includes(value);
}

function isHostedDemoPage() {
  if (typeof window === 'undefined' || !window.location?.hostname) {
    return false;
  }

  return window.location.hostname.toLowerCase().endsWith('.github.io');
}
