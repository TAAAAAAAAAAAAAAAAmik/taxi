import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.DRIVER_DOCUMENTS_SMOKE_PORT || 3313);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/driver-documents-smoke-db.json');
const storagePath = resolve(process.cwd(), '.data/driver-documents-smoke-files');
const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

let backend;

try {
  await rm(dbPath, { force: true });
  await rm(storagePath, { force: true, recursive: true });
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_DB_PATH: dbPath,
      MVP_DOCUMENT_STORAGE_PATH: storagePath,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backend.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  await waitForBackend();

  const stamp = Date.now();
  const registered = await api('/auth/register', {
    body: {
      carBrand: 'Lada',
      carModel: 'Vesta',
      carPlate: 'D404OC102',
      email: `docs-${stamp}@example.test`,
      firstName: 'Docs',
      lastName: 'Driver',
      password: 'password-1',
      phone: `+7930${String(stamp).slice(-7)}`,
      role: 'driver',
      vehicleDocumentsReady: 'yes',
    },
    method: 'POST',
  });
  const drivers = await api('/drivers');
  const driver = drivers.drivers.find((item) => item.userId === registered.user.id);

  assert(driver, 'Driver profile should be created');

  const uploaded = await api(`/drivers/${encodeURIComponent(driver.id)}/documents`, {
    body: {
      documents: ['passport', 'driverLicense', 'sts', 'osago'].map((kind) => ({
        base64: tinyPngBase64,
        fileName: `${kind}.png`,
        height: 1,
        kind,
        mimeType: 'image/png',
        source: 'library',
        width: 1,
      })),
    },
    method: 'POST',
    token: registered.session.token,
  });

  assert(uploaded.driver.documentsStatus === 'pending', 'Documents should move driver to pending review');
  assert(uploaded.driver.vehiclePermitStatus === 'pending', 'Vehicle documents should move permit to pending');

  for (const kind of ['passport', 'driverLicense', 'sts', 'osago']) {
    const upload = uploaded.driver.documentUploads?.[kind];

    assert(upload?.status === 'pending', `${kind} upload should be pending`);
    assert(upload?.storageKey, `${kind} upload should have storage key`);
  }

  console.log('Driver documents smoke test passed');
} finally {
  if (backend) {
    backend.kill();
  }

  await rm(dbPath, { force: true });
  await rm(storagePath, { force: true, recursive: true });
}

async function waitForBackend() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5000) {
    try {
      await api('/health');
      return;
    } catch {
      await delay(100);
    }
  }

  throw new Error('Backend did not start in time');
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed: ${response.status} ${path}`);
  }

  return payload;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
