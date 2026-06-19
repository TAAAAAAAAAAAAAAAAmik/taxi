import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const env = { ...process.env };
const envFiles = process.argv.slice(2);
const errors = [];
const warnings = [];

for (const envFile of envFiles) {
  loadEnvFile(resolve(process.cwd(), envFile), env);
}

requireValue('EXPO_PUBLIC_APP_ENV', (value) => value === 'production', 'must be production');
requireValue('EXPO_PUBLIC_ENABLE_DEMO', (value) => value === 'false', 'must be false');
forbidTruthy('EXPO_PUBLIC_SKIP_PHONE_VERIFICATION', 'must be disabled in production');
requireHttpsUrl('EXPO_PUBLIC_API_URL');
requireDomain('EXPO_PUBLIC_LINKS_DOMAIN');
requireHttpsUrl('EXPO_PUBLIC_TERMS_URL');
requireHttpsUrl('EXPO_PUBLIC_PRIVACY_URL');
requireHttpsUrl('EXPO_PUBLIC_PERSONAL_DATA_CONSENT_URL');
requireEmail('EXPO_PUBLIC_SUPPORT_EMAIL');

requireValue('MVP_BACKEND_ENV', (value) => value === 'production', 'must be production');
forbidTruthy('MVP_SKIP_PHONE_VERIFICATION', 'must be disabled in production');
requireValue('MVP_STORAGE_DRIVER', (value) => value === 'postgres', 'must be postgres');
requireValue('MVP_DATABASE_URL', (value) => value.length > 0, 'is required');
requireValue('MVP_DOCUMENT_STORAGE_PATH', (value) => value.length > 0, 'is required');
requireStrongSecret('MVP_ADMIN_PASSWORD');
requireValue('MVP_DELIVERY_MODE', (value) => value === 'live', 'must be live');

const apiOrigin = env.MVP_API_ORIGIN || env.EXPO_PUBLIC_API_URL;
const linksOrigin = env.MVP_LINKS_ORIGIN || env.EXPO_PUBLIC_LINKS_DOMAIN;
requireHttpsUrlValue('MVP_API_ORIGIN or EXPO_PUBLIC_API_URL', apiOrigin);
requireDomainValue('MVP_LINKS_ORIGIN or EXPO_PUBLIC_LINKS_DOMAIN', linksOrigin);
requireHttpsUrl('MVP_INVITE_BASE_URL');
requireHttpsUrl('MVP_PAYMENT_RETURN_URL');

const paymentMode = normalize(env.MVP_PAYMENT_PROVIDER_MODE);
const paymentProvider = normalize(env.MVP_PAYMENT_PROVIDER);

requireValue('MVP_PAYMENT_PROVIDER_MODE', (value) => value === 'live' || value === 'manual', 'must be live or manual');
requireValue('MVP_PAYMENT_PROVIDER', (value) => value.length > 0 && value !== 'demo-acquiring', 'must be real provider or manual');

if (paymentMode === 'live') {
  if (paymentProvider === 'tbank' || paymentProvider === 't-bank') {
    requireStrongSecret('MVP_TBANK_TERMINAL_KEY');
    requireStrongSecret('MVP_TBANK_PASSWORD');
    requireHttpsUrl('MVP_TBANK_NOTIFICATION_URL');
    requireStrongSecret('MVP_TBANK_WEBHOOK_TOKEN');
  } else if (paymentProvider === 'yookassa' || paymentProvider === 'yoo-kassa') {
    requireStrongSecret('MVP_YOOKASSA_SHOP_ID');
    requireStrongSecret('MVP_YOOKASSA_SECRET_KEY');
    requireStrongSecret('MVP_YOOKASSA_WEBHOOK_TOKEN');
    warnings.push(
      'Set YooKassa cabinet webhook to POST /payments/yookassa/webhook?token=$MVP_YOOKASSA_WEBHOOK_TOKEN on the API domain.',
    );
  } else {
    errors.push('MVP_PAYMENT_PROVIDER_MODE=live requires MVP_PAYMENT_PROVIDER=tbank or yookassa');
  }
}

if (errors.length) {
  console.error('Release env check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log('Release env check passed.');
}

if (warnings.length) {
  console.log('');
  console.log('Warnings:');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

function loadEnvFile(path, target) {
  if (!existsSync(path)) {
    errors.push(`Env file not found: ${path}`);
    return;
  }

  const content = readFileSync(path, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripQuotes(line.slice(separatorIndex + 1).trim());

    if (key && !(key in target)) {
      target[key] = value;
    }
  }
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function requireValue(key, predicate, message) {
  const value = normalize(env[key]);

  if (!predicate(value) || isUnsafePublicValue(value)) {
    errors.push(`${key} ${message}`);
  }
}

function requireStrongSecret(key) {
  const value = normalize(env[key]);

  if (!value || isUnsafePublicValue(value) || value.length < 8) {
    errors.push(`${key} must be set to a non-demo secret`);
  }
}

function requireHttpsUrl(key) {
  requireHttpsUrlValue(key, env[key]);
}

function requireHttpsUrlValue(label, value) {
  const rawValue = normalize(value);

  if (!rawValue || isUnsafePublicValue(rawValue)) {
    errors.push(`${label} must be a real HTTPS URL`);
    return;
  }

  try {
    const url = new URL(rawValue);

    if (url.protocol !== 'https:') {
      errors.push(`${label} must use HTTPS`);
    }
  } catch {
    errors.push(`${label} must be a valid URL`);
  }
}

function requireDomain(key) {
  requireDomainValue(key, env[key]);
}

function requireDomainValue(label, value) {
  const rawValue = normalize(value);

  if (!rawValue || isUnsafePublicValue(rawValue)) {
    errors.push(`${label} must be a real public domain`);
    return;
  }

  try {
    const url = new URL(/^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`);

    if (url.protocol !== 'https:' || !url.hostname.includes('.')) {
      errors.push(`${label} must resolve to an HTTPS domain`);
    }
  } catch {
    errors.push(`${label} must be a valid domain`);
  }
}

function requireEmail(key) {
  const value = normalize(env[key]);

  if (!value || isUnsafePublicValue(value) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
    errors.push(`${key} must be a real email address`);
  }
}

function forbidTruthy(key, message) {
  const value = normalize(env[key]);

  if (['1', 'true', 'yes', 'on'].includes(value)) {
    errors.push(`${key} ${message}`);
  }
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isUnsafePublicValue(value) {
  return (
    /example\.(com|net|org|test)/i.test(value) ||
    /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::|\/|$)/i.test(value) ||
    /^demo\b|demo-|password123|admin-demo|change-me|<[^>]+>/i.test(value)
  );
}
