import { networkInterfaces } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const easPath = resolve(process.cwd(), 'eas.json');
const port = String(process.env.PILOT_API_PORT || process.env.PORT || '3100');
const explicitHost = String(process.env.PILOT_API_HOST || '').trim();
const host = explicitHost || findLanIpv4();

if (!host) {
  console.error('Could not find LAN IPv4. Set PILOT_API_HOST manually, for example PILOT_API_HOST=192.168.1.10.');
  process.exit(1);
}

const eas = JSON.parse(await readFile(easPath, 'utf8'));
const profile = eas.build?.['pilot-apk'];

if (!profile) {
  console.error('eas.json must contain build.pilot-apk profile.');
  process.exit(1);
}

profile.env = {
  ...(profile.env || {}),
  EXPO_PUBLIC_API_URL: `http://${host}:${port}`,
  EXPO_PUBLIC_APP_ENV: 'pilot',
  EXPO_PUBLIC_ENABLE_DEMO: 'false',
  EXPO_PUBLIC_SKIP_PHONE_VERIFICATION: 'true',
};

await writeFile(`${easPath}`, `${JSON.stringify(eas, null, 2)}\n`);

console.log(`Pilot APK API URL: ${profile.env.EXPO_PUBLIC_API_URL}`);
console.log('Phone verification is skipped for this pilot APK profile.');

function findLanIpv4() {
  const candidates = Object.values(networkInterfaces())
    .flatMap((items) => items || [])
    .filter((item) => item.family === 'IPv4' && !item.internal)
    .map((item) => item.address)
    .filter((address) => !address.startsWith('169.254.'));

  return (
    candidates.find((address) => /^10\./.test(address)) ||
    candidates.find((address) => /^192\.168\./.test(address)) ||
    candidates.find((address) => /^172\.(1[6-9]|2\d|3[01])\./.test(address)) ||
    candidates[0] ||
    ''
  );
}
