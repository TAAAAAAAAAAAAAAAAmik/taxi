import { spawn } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.DRIVER_DOCUMENTS_SMOKE_PORT || 3313);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/driver-documents-smoke-db.json');
const storagePath = resolve(process.cwd(), '.data/driver-documents-smoke-files');
const tinyPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
const tinyPngBuffer = Buffer.from(tinyPngBase64, 'base64');

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

  const admin = await loginAdmin();
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
  const drivers = await api('/drivers', {
    token: admin.session.token,
  });
  const driver = drivers.drivers.find((item) => item.userId === registered.user.id);

  assert(driver, 'Driver profile should be created');

  const uploaded = await api(`/drivers/${encodeURIComponent(driver.id)}/documents`, {
    body: {
      documents: ['passport', 'driverLicense', 'sts', 'osago', 'osgop'].map((kind) => ({
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
  assert(uploaded.driver.documentReview?.status === 'pending', 'Document review should be pending');
  assert(uploaded.driver.documentAudit?.[0]?.action === 'uploaded', 'Upload should be audited');
  assert(uploaded.driver.vehiclePermitStatus === 'pending', 'Vehicle documents should move permit to pending');

  for (const kind of ['passport', 'driverLicense', 'sts', 'osago', 'osgop']) {
    const upload = uploaded.driver.documentUploads?.[kind];

    assert(upload?.status === 'pending', `${kind} upload should be pending`);
    assert(!upload?.storageKey, `${kind} storage key should not be exposed to driver session`);
  }

  const adminDrivers = await api('/drivers', {
    token: admin.session.token,
  });
  const adminDriver = adminDrivers.drivers.find((item) => item.id === driver.id);

  assert(adminDriver?.documentUploads?.passport?.storageKey, 'Admin should see protected storage key');

  const deniedFile = await apiRaw(`/drivers/${encodeURIComponent(driver.id)}/documents/passport/file`, {
    token: registered.session.token,
  });

  assert(deniedFile.status === 403, 'Driver session should not read protected document files');

  const protectedFile = await apiRaw(`/drivers/${encodeURIComponent(driver.id)}/documents/passport/file`, {
    token: admin.session.token,
  });
  const protectedFileBuffer = Buffer.from(await protectedFile.arrayBuffer());

  assert(protectedFile.status === 200, 'Admin should read protected document file');
  assert(
    protectedFile.headers.get('content-type') === 'image/png',
    'Protected document response should preserve MIME type',
  );
  assert(
    protectedFileBuffer.equals(tinyPngBuffer),
    'Protected document response should return stored file bytes',
  );

  const adminDriversAfterView = await api('/drivers', {
    token: admin.session.token,
  });
  const viewedDriver = adminDriversAfterView.drivers.find((item) => item.id === driver.id);

  assert(viewedDriver?.documentAudit?.[0]?.action === 'viewed', 'Document file access should be audited');
  assert(viewedDriver?.documentAudit?.[0]?.actor.role === 'admin', 'Document file audit actor should be admin');

  const rejected = await api(`/drivers/${encodeURIComponent(driver.id)}/documents/review`, {
    body: {
      reason: 'Фото паспорта не читается',
      rejectedKinds: ['passport'],
      status: 'rejected',
    },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(rejected.driver.documentsStatus === 'rejected', 'Rejected review should reject document package');
  assert(
    rejected.driver.documentUploads?.passport?.rejectionReason === 'Фото паспорта не читается',
    'Rejected document should keep rejection reason',
  );
  assert(
    rejected.driver.documentAudit?.[0]?.action === 'rejected',
    'Rejected review should be added to audit',
  );

  const reuploaded = await api(`/drivers/${encodeURIComponent(driver.id)}/documents`, {
    body: {
      documents: [
        {
          base64: tinyPngBase64,
          fileName: 'passport-fixed.png',
          height: 1,
          kind: 'passport',
          mimeType: 'image/png',
          source: 'library',
          width: 1,
        },
      ],
    },
    method: 'POST',
    token: registered.session.token,
  });

  assert(reuploaded.driver.documentsStatus === 'pending', 'Reupload should return package to pending');
  assert(reuploaded.driver.documentUploads?.passport?.status === 'pending', 'Reuploaded document should be pending');

  // Заменённый файл паспорта должен удаляться из хранилища (чистка в фоне).
  await delay(300);
  const storedFilesAfterReupload = await countStoredFiles();

  assert(
    storedFilesAfterReupload === 5,
    `Replaced document file should be cleaned up (expected 5 files, got ${storedFilesAfterReupload})`,
  );

  // Пачка атомарна: битый документ отклоняет весь запрос, валидный сосед из
  // той же пачки не применяется и файлов после отказа не прибавляется.
  const driverLicenseBefore = (await api('/drivers', { token: admin.session.token }))
    .drivers.find((item) => item.id === driver.id)?.documentUploads?.driverLicense;
  const failedBatch = await apiRaw(`/drivers/${encodeURIComponent(driver.id)}/documents`, {
    body: {
      documents: [
        {
          base64: tinyPngBase64,
          fileName: 'license-new.png',
          height: 1,
          kind: 'driverLicense',
          mimeType: 'image/png',
          source: 'library',
          width: 1,
        },
        {
          base64: '',
          fileName: 'sts-broken.png',
          height: 1,
          kind: 'sts',
          mimeType: 'image/png',
          source: 'library',
          width: 1,
        },
      ],
    },
    method: 'POST',
    token: registered.session.token,
  });

  assert(failedBatch.status === 400, 'Broken document should reject the whole batch');

  const driverLicenseAfter = (await api('/drivers', { token: admin.session.token }))
    .drivers.find((item) => item.id === driver.id)?.documentUploads?.driverLicense;

  assert(
    driverLicenseAfter?.uploadedAt === driverLicenseBefore?.uploadedAt &&
      driverLicenseAfter?.storageKey === driverLicenseBefore?.storageKey,
    'Valid document from a rejected batch should not be applied',
  );

  const storedFilesAfterFailedBatch = await countStoredFiles();

  assert(
    storedFilesAfterFailedBatch === 5,
    `Rejected batch should not leave orphan files (expected 5 files, got ${storedFilesAfterFailedBatch})`,
  );

  const approved = await api(`/drivers/${encodeURIComponent(driver.id)}/documents/review`, {
    body: {
      note: 'Пакет документов читается',
      status: 'approved',
    },
    method: 'PATCH',
    token: admin.session.token,
  });

  assert(approved.driver.documentsStatus === 'approved', 'Approved review should approve documents');
  assert(approved.driver.vehiclePermitStatus === 'approved', 'Approved vehicle files should approve permit status');

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

async function loginAdmin() {
  return api('/auth/admin-login', {
    body: {
      password: 'smoke-admin',
    },
    method: 'POST',
  });
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

async function apiRaw(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      accept: options.accept || '*/*',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

async function countStoredFiles() {
  const entries = await readdir(storagePath, { recursive: true, withFileTypes: true }).catch(() => []);

  return entries.filter((entry) => entry.isFile()).length;
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
