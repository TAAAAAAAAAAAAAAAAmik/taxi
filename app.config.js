const appEnv = String(process.env.EXPO_PUBLIC_APP_ENV || process.env.APP_ENV || '').trim().toLowerCase();
const easBuildProfile = String(process.env.EAS_BUILD_PROFILE || '').trim().toLowerCase();
const isProductionBuild = appEnv === 'production' || easBuildProfile === 'production';

const apiBaseUrl = normalizeHttpsUrl(process.env.EXPO_PUBLIC_API_URL);
const linksDomain = normalizeDomain(process.env.EXPO_PUBLIC_LINKS_DOMAIN || process.env.MVP_LINKS_ORIGIN);
const legal = compact({
  personalDataConsentUrl: normalizeHttpsUrl(process.env.EXPO_PUBLIC_PERSONAL_DATA_CONSENT_URL),
  privacyUrl: normalizeHttpsUrl(process.env.EXPO_PUBLIC_PRIVACY_URL),
  termsUrl: normalizeHttpsUrl(process.env.EXPO_PUBLIC_TERMS_URL),
});
const supportEmail = normalizeEmail(process.env.EXPO_PUBLIC_SUPPORT_EMAIL);

assertProductionConfig();

module.exports = {
  expo: {
    name: 'Такси Салават',
    slug: 'taxi-partner-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'taxipartner',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0C0C0C',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'ru.taxipartner.app',
      associatedDomains: linksDomain ? [`applinks:${linksDomain}`] : [],
    },
    android: {
      package: 'ru.taxipartner.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0C0C0C',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      intentFilters: linksDomain
        ? [
            {
              action: 'VIEW',
              autoVerify: true,
              data: [
                {
                  scheme: 'https',
                  host: linksDomain,
                  pathPrefix: '/invite',
                },
              ],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ]
        : [],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-image-picker',
        {
          cameraPermission: 'Нужно сделать фото документов водителя для проверки допуска.',
          photosPermission: 'Нужно выбрать фото документов водителя для проверки допуска.',
        },
      ],
      [
        'expo-notifications',
        {
          color: '#F6C600',
          defaultChannel: 'driver-orders',
          enableBackgroundRemoteNotifications: true,
        },
      ],
    ],
    extra: compact({
      apiBaseUrl,
      linksDomain,
      legal,
      supportEmail,
    }),
  },
};

function assertProductionConfig() {
  if (!isProductionBuild) {
    return;
  }

  const errors = [];

  if (!apiBaseUrl) {
    errors.push('EXPO_PUBLIC_API_URL must be a real HTTPS API origin');
  }

  if (!linksDomain) {
    errors.push('EXPO_PUBLIC_LINKS_DOMAIN must be a real HTTPS app-links domain');
  }

  for (const key of [
    'EXPO_PUBLIC_TERMS_URL',
    'EXPO_PUBLIC_PRIVACY_URL',
    'EXPO_PUBLIC_PERSONAL_DATA_CONSENT_URL',
  ]) {
    if (!normalizeHttpsUrl(process.env[key])) {
      errors.push(`${key} must be a real HTTPS document URL`);
    }
  }

  if (!supportEmail) {
    errors.push('EXPO_PUBLIC_SUPPORT_EMAIL must be a real support email');
  }

  if (String(process.env.EXPO_PUBLIC_ENABLE_DEMO || '').trim().toLowerCase() !== 'false') {
    errors.push('EXPO_PUBLIC_ENABLE_DEMO=false is required for production builds');
  }

  if (errors.length) {
    throw new Error(`Production Expo config is incomplete: ${errors.join('; ')}`);
  }
}

function normalizeHttpsUrl(value) {
  const rawValue = String(value || '').trim().replace(/\/+$/, '');

  if (!rawValue || isUnsafePublicValue(rawValue)) {
    return '';
  }

  try {
    const url = new URL(rawValue);
    return url.protocol === 'https:' ? url.toString().replace(/\/+$/, '') : '';
  } catch {
    return '';
  }
}

function normalizeDomain(value) {
  const rawValue = String(value || '').trim();

  if (!rawValue || isUnsafePublicValue(rawValue)) {
    return '';
  }

  try {
    const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`);
    return url.protocol === 'https:' ? url.hostname.toLowerCase() : '';
  } catch {
    return '';
  }
}

function normalizeEmail(value) {
  const email = String(value || '').trim();

  return email && !isUnsafePublicValue(email) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : '';
}

function isUnsafePublicValue(value) {
  return (
    /example\.(com|net|org|test)/i.test(value) ||
    /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(value) ||
    /<[^>]+>/.test(value)
  );
}

function compact(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === undefined || item === '') {
        return false;
      }

      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return Object.keys(item).length > 0;
      }

      return true;
    }),
  );
}
