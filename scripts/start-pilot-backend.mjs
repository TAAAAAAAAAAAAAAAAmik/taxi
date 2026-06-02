const adminPassword = String(process.env.MVP_ADMIN_PASSWORD || '').trim() || 'pilot-admin-local';

process.env.MVP_ADMIN_PASSWORD = adminPassword;
process.env.MVP_BACKEND_ENV = process.env.MVP_BACKEND_ENV || 'development';
process.env.MVP_DELIVERY_MODE = process.env.MVP_DELIVERY_MODE || 'demo';
process.env.MVP_PAYMENT_PROVIDER = process.env.MVP_PAYMENT_PROVIDER || 'manual';
process.env.MVP_PAYMENT_PROVIDER_MODE = process.env.MVP_PAYMENT_PROVIDER_MODE || 'manual';
process.env.MVP_SKIP_PHONE_VERIFICATION = 'true';
process.env.PORT = process.env.PORT || '3100';

console.log('Starting pilot backend');
console.log(`- API: http://0.0.0.0:${process.env.PORT}`);
console.log('- SMS verification: skipped');
console.log('- Email verification: MVP code on screen/API unless live delivery env is provided');
console.log(`- Admin password: ${adminPassword}`);
console.log('');

await import('./mvp-backend.mjs');
