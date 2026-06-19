import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.SMS_GATEWAY_PORT || 8787);
const bindHost = process.env.SMS_GATEWAY_BIND || '0.0.0.0';
const token = String(process.env.SMS_GATEWAY_TOKEN || '').trim();
const dryRun = ['1', 'true', 'yes'].includes(String(process.env.SMS_GATEWAY_DRY_RUN || '').toLowerCase());

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  let body = '';

  for await (const chunk of request) {
    body += chunk;

    if (body.length > 16_384) {
      throw new Error('Request body is too large');
    }
  }

  return body ? JSON.parse(body) : {};
}

function isAuthorized(request) {
  if (!token) {
    return true;
  }

  return request.headers.authorization === `Bearer ${token}`;
}

function normalizePhone(value) {
  const phone = String(value || '').replace(/[^\d+]/g, '');

  if (!/^\+?\d{10,15}$/.test(phone)) {
    throw new Error('Invalid phone number');
  }

  return phone;
}

function normalizeText(value) {
  const text = String(value || '').trim();

  if (!text) {
    throw new Error('SMS text is required');
  }

  if (text.length > 480) {
    throw new Error('SMS text is too long');
  }

  return text;
}

function sendSmsViaTermux(phone, text) {
  return new Promise((resolve, reject) => {
    const child = spawn('termux-sms-send', ['-n', phone, text], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(new Error(`termux-sms-send failed to start: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `termux-sms-send exited with code ${code}`));
    });
  });
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, {
        ok: true,
        service: 'android-sms-gateway',
      });
      return;
    }

    if (request.method !== 'POST' || request.url !== '/send-sms') {
      sendJson(response, 404, { error: 'Route not found' });
      return;
    }

    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: 'Unauthorized' });
      return;
    }

    const payload = await readJsonBody(request);
    const phone = normalizePhone(payload.to || payload.phone);
    const text = normalizeText(payload.text || payload.message);
    const messageId = `android-sms-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

    if (!dryRun) {
      await sendSmsViaTermux(phone, text);
    }

    sendJson(response, 200, {
      id: messageId,
      messageId,
      ok: true,
      provider: dryRun ? 'android-termux-dry-run' : 'android-termux',
    });
  } catch (error) {
    sendJson(response, 400, {
      error: error instanceof Error ? error.message : 'Bad request',
      ok: false,
    });
  }
});

server.listen(port, bindHost, () => {
  console.log(`Android SMS gateway: http://${bindHost}:${port}/send-sms`);
  console.log(token ? 'Auth: bearer token enabled' : 'Auth: disabled');
  console.log(dryRun ? 'Mode: dry-run, SMS will not be sent' : 'Mode: live, SMS will be sent via termux-sms-send');
});
