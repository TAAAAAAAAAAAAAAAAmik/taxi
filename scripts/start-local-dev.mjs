import { openSync } from 'node:fs';
import { connect } from 'node:net';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const projectRoot = process.cwd();
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const startupTimeoutMs = 45_000;

const servers = [
  {
    name: 'backend',
    port: 3100,
    command: 'npm.cmd run backend',
    logFile: `backend-${runId}.log`,
    errorFile: `backend-${runId}.err.log`,
    url: 'http://localhost:3100/health',
  },
  {
    name: 'web',
    port: 8093,
    command: 'set BROWSER=none&& npm.cmd run web -- --port 8093 --offline',
    logFile: `expo-web-8093-${runId}.log`,
    errorFile: `expo-web-8093-${runId}.err.log`,
    url: 'http://localhost:8093',
  },
];

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });

    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortOpen(port)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return false;
}

function launch({ name, command, logFile, errorFile }) {
  const stdout = openSync(join(projectRoot, logFile), 'w');
  const stderr = openSync(join(projectRoot, errorFile), 'w');

  const child = spawn('cmd.exe', ['/d', '/s', '/c', command], {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', stdout, stderr],
    windowsHide: true,
  });

  child.unref();
  return { errorFile, logFile, name, pid: child.pid };
}

async function ensureServer(server) {
  if (await isPortOpen(server.port)) {
    return {
      ...server,
      status: 'already running',
    };
  }

  const processInfo = launch(server);
  const ready = await waitForPort(server.port, startupTimeoutMs);

  return {
    ...server,
    ...processInfo,
    status: ready ? 'started' : 'not ready',
  };
}

const results = await Promise.all(servers.map(ensureServer));
const failed = results.filter((result) => result.status === 'not ready');

console.log('Taxi Partner local dev');
for (const result of results) {
  console.log(`- ${result.name}: ${result.status} on port ${result.port}`);

  if (result.pid) {
    console.log(`  pid: ${result.pid}`);
    console.log(`  logs: ${result.logFile}`);
    console.log(`  errors: ${result.errorFile}`);
  }
}

console.log('');
console.log('Open: http://localhost:8093');
console.log('Admin: http://localhost:8093/admin');
console.log('API health: http://localhost:3100/health');
console.log('');
console.log('Demo client: demo-client@example.test / Kinetix123');
console.log('Demo driver: demo-driver@example.test / Kinetix123');
console.log('Admin password: admin-demo-5000');

if (failed.length > 0) {
  process.exitCode = 1;
}
