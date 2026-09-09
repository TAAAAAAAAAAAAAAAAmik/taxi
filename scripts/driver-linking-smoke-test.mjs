// Парк заводит водителей через админку заранее, а те ставят приложение
// позже. Если карточку не забрать по телефону, у человека появится второй
// пустой профиль, а подготовленный админом останется без владельца — и
// водитель никогда не выйдет на линию.
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const port = Number(process.env.DRIVER_LINKING_SMOKE_PORT || 3321);
const baseUrl = `http://localhost:${port}`;
const dbPath = resolve(process.cwd(), '.data/driver-linking-smoke-db.json');

let backend;

try {
  await rm(dbPath, { force: true });
  backend = spawn(process.execPath, ['scripts/mvp-backend.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MVP_ADMIN_PASSWORD: 'smoke-admin',
      MVP_CODE_REQUEST_COOLDOWN_SECONDS: '0',
      MVP_DB_PATH: dbPath,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backend.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  await waitForBackend();

  const admin = await api('/auth/admin-login', { body: { password: 'smoke-admin' }, method: 'POST' });
  const adminToken = admin.session.token;
  const stamp = Date.now();
  const parkPhone = `+7930${String(stamp).slice(-7)}`;

  // 1. Парк заводит водителя заранее — аккаунта у того ещё нет.
  const prepared = await api('/drivers', {
    body: {
      name: 'Ильдар Заранее',
      phone: parkPhone,
      plate: 'В001АА102',
      status: 'approved',
      vehicle: 'Lada Vesta',
    },
    method: 'POST',
    token: adminToken,
  });

  assert(!prepared.driver.userId, 'Prepared card must start without an account');

  await api(`/drivers/${encodeURIComponent(prepared.driver.id)}/compliance`, {
    body: {
      contractStatus: 'signed',
      documentsStatus: 'approved',
      registryStatus: 'active',
      taxProfileStatus: 'approved',
      vehiclePermitStatus: 'approved',
    },
    method: 'PATCH',
    token: adminToken,
  });

  // 2. Тот же человек ставит приложение и регистрируется по тому же номеру.
  const registered = await api('/auth/register', {
    body: {
      email: `linking-${stamp}@example.test`,
      firstName: 'Ильдар',
      lastName: 'Заранее',
      password: 'password-1',
      phone: parkPhone,
      role: 'self_employed_driver',
    },
    method: 'POST',
  });

  const userId = registered.user.id;
  const listed = await api('/drivers', { token: adminToken });
  const mine = listed.drivers.filter((driver) => driver.userId === userId);

  assert(mine.length === 1, `Driver must own exactly one card, got ${mine.length}`);
  assert(
    mine[0].id === prepared.driver.id,
    'Registration must claim the card prepared by the park, not create a new one',
  );
  // Допуск к заказам зависит ещё и от оплаты доступа — здесь проверяем
  // именно то, что собрал парк: одобрение и документы не потерялись.
  assert(mine[0].status === 'approved', 'Claimed card must keep the approved status');
  assert(
    mine[0].documentsStatus === 'approved',
    'Claimed card must keep the documents the park already approved',
  );

  const orphans = listed.drivers.filter((driver) => !driver.userId && driver.phone === parkPhone);
  assert(!orphans.length, 'No orphan card must remain for that phone');

  // 3. Водитель без подготовленной карточки получает свою, новую.
  const freshPhone = `+7931${String(stamp).slice(-7)}`;
  const freshUser = await api('/auth/register', {
    body: {
      email: `fresh-${stamp}@example.test`,
      firstName: 'Азат',
      lastName: 'Новый',
      password: 'password-1',
      phone: freshPhone,
      role: 'self_employed_driver',
    },
    method: 'POST',
  });

  const afterFresh = await api('/drivers', { token: adminToken });
  const freshCards = afterFresh.drivers.filter((driver) => driver.userId === freshUser.user.id);

  assert(freshCards.length === 1, 'Driver without a prepared card must still get one');
  assert(freshCards[0].status === 'pending', 'A self-registered driver starts as pending');

  // 4. Админ может привязать карточку к аккаунту осознанно, но не дважды.
  const duplicate = await fetch(`${baseUrl}/drivers`, {
    body: JSON.stringify({ name: 'Дубль', phone: freshPhone, userId: freshUser.user.id }),
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    method: 'POST',
  });

  assert(duplicate.status === 409, `Second card for one user must be refused, got ${duplicate.status}`);

  console.log('Driver linking smoke test passed');
} finally {
  if (backend) {
    backend.kill('SIGTERM');
  }

  await rm(dbPath, { force: true });
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    method: options.method || 'GET',
  });

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Бэкенд ещё поднимается.
    }

    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 250);
    });
  }

  throw new Error('Backend did not start in time');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
