import { spawn } from 'node:child_process';

const checks = [
  {
    name: 'TypeScript',
    command: process.execPath,
    args: ['--stack_size=8192', 'node_modules/typescript/lib/tsc.js', '--noEmit'],
  },
  {
    name: 'Registration without SMS pilot flow',
    command: process.execPath,
    args: ['scripts/registration-no-sms-smoke-test.mjs'],
  },
  {
    name: 'Dispatch and driver order flow',
    command: process.execPath,
    args: ['scripts/dispatch-smoke-test.mjs'],
  },
  {
    name: 'Driver billing, trial, PRO, 7/5/3 settlement',
    command: process.execPath,
    args: ['scripts/driver-billing-smoke-test.mjs'],
  },
  {
    name: 'Driver documents and admin review',
    command: process.execPath,
    args: ['scripts/driver-documents-smoke-test.mjs'],
  },
  {
    name: 'Referral rules',
    command: process.execPath,
    args: ['scripts/referral-smoke-test.mjs'],
  },
  {
    name: 'Realtime updates',
    command: process.execPath,
    args: ['scripts/realtime-smoke-test.mjs'],
  },
];

console.log('Closed pilot readiness checks');
console.log('This verifies the core local pilot loop before a phone build or hosted pilot.');
console.log('');

for (const check of checks) {
  console.log(`\n[check] ${check.name}`);
  await run(check.command, check.args);
}

console.log('');
console.log('Closed pilot readiness checks passed.');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      shell: false,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}
