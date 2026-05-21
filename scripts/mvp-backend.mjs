import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { URL } from 'node:url';

const port = Number(process.env.PORT || 3100);
const dbPath = resolve(process.cwd(), process.env.MVP_DB_PATH || '.data/mvp-db.json');
const adminPassword = process.env.MVP_ADMIN_PASSWORD || 'admin-demo-5000';

const seedDrivers = [
  {
    id: 'driver-alexey-solaris',
    name: 'Алексей',
    phone: '+7 917 000-42-11',
    rating: 4.92,
    vehicle: 'Hyundai Solaris',
    plate: 'А123ВС 102',
    status: 'approved',
    billingMode: 'commission',
    subscriptionStatus: 'active',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'driver-rinat-logan',
    name: 'Ринат',
    phone: '+7 917 000-10-24',
    rating: 4.86,
    vehicle: 'Renault Logan',
    plate: 'В456КМ 102',
    status: 'pending',
    billingMode: 'commission',
    subscriptionStatus: 'inactive',
    updatedAt: new Date().toISOString(),
  },
];

function createDefaultDb() {
  return {
    version: 1,
    orders: [],
    drivers: seedDrivers.map((driver) => ({ ...driver })),
    users: [],
    sessions: [],
    supportThreads: [],
  };
}

async function readDb() {
  try {
    const raw = await readFile(dbPath, 'utf8');
    const parsed = JSON.parse(raw);
    const defaultDb = createDefaultDb();

    return {
      ...defaultDb,
      ...parsed,
      drivers: Array.isArray(parsed.drivers) && parsed.drivers.length > 0 ? parsed.drivers : seedDrivers,
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      supportThreads: Array.isArray(parsed.supportThreads) ? parsed.supportThreads : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
  } catch (error) {
    const defaultDb = createDefaultDb();

    if (error.code !== 'ENOENT') {
      console.warn(`MVP DB read failed, starting with empty DB: ${error.message}`);
    }

    await writeDb(defaultDb);
    return defaultDb;
  }
}

async function writeDb(db) {
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        request.destroy();
        rejectBody(new Error('Request body too large'));
      }
    });

    request.on('end', () => {
      if (!body.trim()) {
        resolveBody({});
        return;
      }

      try {
        resolveBody(JSON.parse(body));
      } catch {
        rejectBody(new Error('Invalid JSON'));
      }
    });
  });
}

function makeOrder(payload) {
  const now = new Date().toISOString();
  const role = normalizeRole(payload.role);
  const status = role === 'driver' ? 'accepted' : role === 'fleet' ? 'created' : 'searching';

  return {
    id: `TX-${Date.now().toString().slice(-6)}`,
    role,
    pickup: requireString(payload.pickup, 'pickup'),
    destination: requireString(payload.destination, 'destination'),
    tariff: String(payload.tariff || 'Эконом'),
    total: Number(payload.total || 0),
    paymentMethod: String(payload.paymentMethod || 'Наличные'),
    options: Array.isArray(payload.options) ? payload.options.map(String) : [],
    clientName: String(payload.clientName || ''),
    clientPhone: String(payload.clientPhone || ''),
    status,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeRole(value) {
  return ['client', 'driver', 'fleet'].includes(value) ? value : 'client';
}

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function createReceipt(order) {
  return {
    id: `RC-${Date.now().toString().slice(-7)}`,
    orderId: order.id,
    issuedAt: new Date().toISOString(),
    total: order.total,
    paymentMethod: order.paymentMethod,
    fiscalStatus: 'server',
  };
}

function hashPassword(password) {
  return createHash('sha256').update(String(password)).digest('hex');
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function makeSession(userId, role) {
  return {
    id: randomUUID(),
    role,
    token: randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
  };
}

function normalizeIdentifier(value) {
  return String(value || '').trim().toLowerCase();
}

function findUserByIdentifier(users, identifier) {
  const normalized = normalizeIdentifier(identifier);

  return users.find(
    (user) =>
      normalizeIdentifier(user.email) === normalized ||
      normalizeIdentifier(user.phone) === normalized,
  );
}

function makeDriverFromUser(user, payload) {
  return {
    id: `driver-${user.id}`,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Водитель',
    phone: user.phone,
    rating: 5,
    vehicle: [payload.carBrand, payload.carModel].filter(Boolean).join(' '),
    plate: String(payload.carPlate || ''),
    status: 'pending',
    billingMode: 'commission',
    subscriptionStatus: 'inactive',
    vehicleDocumentsReady: String(payload.vehicleDocumentsReady || ''),
    userId: user.id,
    updatedAt: new Date().toISOString(),
  };
}

async function handleRequest(request, response) {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const pathParts = url.pathname.split('/').filter(Boolean);

  try {
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, dbPath, service: 'taxi-partner-mvp' });
      return;
    }

    const db = await readDb();

    if (request.method === 'POST' && url.pathname === '/auth/register') {
      const payload = await readBody(request);
      const role = normalizeRole(payload.role);
      const email = String(payload.email || '').trim();
      const phone = String(payload.phone || '').trim();
      const password = String(payload.password || payload.appPassword || '');

      if (!email && !phone) {
        sendJson(response, 400, { error: 'Email or phone is required' });
        return;
      }

      if (password.length < 4) {
        sendJson(response, 400, { error: 'Password is too short' });
        return;
      }

      if (
        (email && findUserByIdentifier(db.users, email)) ||
        (phone && findUserByIdentifier(db.users, phone))
      ) {
        sendJson(response, 409, { error: 'User already exists' });
        return;
      }

      const now = new Date().toISOString();
      const user = {
        id: `user-${Date.now().toString(36)}`,
        role,
        firstName: String(payload.firstName || ''),
        lastName: String(payload.lastName || ''),
        email,
        phone,
        passwordHash: hashPassword(password),
        verificationStatus: role === 'driver' ? 'pending_driver_review' : 'active',
        createdAt: now,
        updatedAt: now,
      };
      const session = makeSession(user.id, role);

      db.users.unshift(user);
      db.sessions.unshift(session);

      if (role === 'driver' && !db.drivers.some((driver) => driver.userId === user.id)) {
        db.drivers.unshift(makeDriverFromUser(user, payload));
      }

      await writeDb(db);
      sendJson(response, 201, { session, user: publicUser(user) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/login') {
      const payload = await readBody(request);
      const user = findUserByIdentifier(db.users, payload.identifier);

      if (!user || user.passwordHash !== hashPassword(payload.password || '')) {
        sendJson(response, 401, { error: 'Invalid login or password' });
        return;
      }

      if (payload.role && user.role !== payload.role) {
        sendJson(response, 403, { error: 'Role mismatch' });
        return;
      }

      const session = makeSession(user.id, user.role);
      db.sessions.unshift(session);
      await writeDb(db);
      sendJson(response, 200, { session, user: publicUser(user) });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/auth/admin-login') {
      const payload = await readBody(request);

      if (String(payload.password || '') !== adminPassword) {
        sendJson(response, 401, { error: 'Invalid admin password' });
        return;
      }

      const user = {
        id: 'admin-local',
        role: 'admin',
        firstName: 'Админ',
        lastName: '',
        email: '',
        phone: '',
        verificationStatus: 'active',
      };
      const session = makeSession(user.id, 'admin');
      db.sessions.unshift(session);
      await writeDb(db);
      sendJson(response, 200, { session, user });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/users') {
      sendJson(response, 200, { users: db.users.map(publicUser) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/drivers') {
      sendJson(response, 200, { drivers: db.drivers });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/drivers') {
      const payload = await readBody(request);
      const now = new Date().toISOString();
      const driver = {
        id: `driver-${Date.now().toString(36)}`,
        name: requireString(payload.name, 'name'),
        phone: String(payload.phone || ''),
        rating: Number(payload.rating || 5),
        vehicle: String(payload.vehicle || ''),
        plate: String(payload.plate || ''),
        status: payload.status === 'approved' ? 'approved' : 'pending',
        billingMode: payload.billingMode === 'monthly' ? 'monthly' : 'commission',
        subscriptionStatus: payload.subscriptionStatus === 'active' ? 'active' : 'inactive',
        updatedAt: now,
      };
      db.drivers.unshift(driver);
      await writeDb(db);
      sendJson(response, 201, { driver });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'drivers' && pathParts[2] === 'status') {
      const payload = await readBody(request);
      const driver = db.drivers.find((item) => item.id === pathParts[1]);

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      driver.status = ['pending', 'approved', 'blocked'].includes(payload.status)
        ? payload.status
        : driver.status;
      driver.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(response, 200, { driver });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/orders') {
      sendJson(response, 200, { orders: db.orders });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/orders') {
      const payload = await readBody(request);
      const order = makeOrder(payload);
      db.orders.unshift(order);
      await writeDb(db);
      sendJson(response, 201, { order });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'status') {
      const payload = await readBody(request);
      const order = db.orders.find((item) => item.id === pathParts[1]);

      if (!order) {
        sendJson(response, 404, { error: 'Order not found' });
        return;
      }

      order.status = String(payload.status || order.status);
      order.updatedAt = new Date().toISOString();

      if (['closed', 'completed'].includes(order.status) && !order.receipt) {
        order.receipt = createReceipt(order);
      }

      await writeDb(db);
      sendJson(response, 200, { order });
      return;
    }

    if (request.method === 'PATCH' && pathParts[0] === 'orders' && pathParts[2] === 'assign') {
      const payload = await readBody(request);
      const order = db.orders.find((item) => item.id === pathParts[1]);
      const driver = db.drivers.find((item) => item.id === payload.driverId);

      if (!order) {
        sendJson(response, 404, { error: 'Order not found' });
        return;
      }

      if (!driver) {
        sendJson(response, 404, { error: 'Driver not found' });
        return;
      }

      order.driver = {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        rating: driver.rating,
        vehicle: driver.vehicle,
        plate: driver.plate,
      };
      order.status = 'assigned';
      order.updatedAt = new Date().toISOString();
      await writeDb(db);
      sendJson(response, 200, { order });
      return;
    }

    sendJson(response, 404, { error: 'Route not found' });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Bad request' });
  }
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(response, 500, { error: error.message || 'Internal error' });
  });
});

server.listen(port, () => {
  console.log(`Taxi Partner MVP backend: http://localhost:${port}`);
  console.log(`JSON DB: ${dbPath}`);
});
