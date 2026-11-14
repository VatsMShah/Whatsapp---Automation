const test = require('node:test');
const assert = require('node:assert');

const DASHBOARD_URL = 'http://localhost:5174';
const BACKEND_URL = 'http://localhost:3005';

test('E2E Dashboard & Backend Server Live Integration Suite', async (t) => {
  let adminToken = '';

  await t.test('1. Vite Dashboard Dev Server: Serves index.html on port 5174', async () => {
    const res = await fetch(DASHBOARD_URL);
    assert.strictEqual(res.status, 200, 'Vite dev server must respond with 200 OK');
    const html = await res.text();
    assert.ok(html.includes('<div id="root"></div>'), 'HTML must contain React root mounting point');
    assert.ok(html.includes('src/main.tsx'), 'HTML must reference main.tsx entrypoint');
  });

  await t.test('2. Backend Auth API: Health check endpoint is online and responsive', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'health' }),
    });
    assert.strictEqual(res.status, 200, 'Backend /api/auth health must return 200 OK');
    const data = await res.json();
    assert.strictEqual(data.ok, true, 'Backend should report ok: true');
    assert.strictEqual(data.status, 'online', 'Backend should report status: online');
  });

  await t.test('3. Admin Authentication: Signs in and receives cryptographically signed JWT', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login_admin',
        identifier: 'admin@traket.in',
        password: 'Traket@Admin2026!',
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true, 'Login should succeed');
    assert.ok(data.token, 'Should return JWT token');
    adminToken = data.token;
    assert.strictEqual(data.user.role, 'admin');
    assert.strictEqual(data.user.email, 'admin@traket.in');
  });

  await t.test('4. Session Verification: Validates active JWT session', async () => {
    assert.ok(adminToken, 'Admin token must exist from login test');
    const res = await fetch(`${BACKEND_URL}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-traket-token': adminToken,
      },
      body: JSON.stringify({ action: 'verify_session' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.valid, true);
    assert.strictEqual(data.role, 'admin');
  });

  await t.test('5. Session Silent Auto-Refresh: Renews token expiry seamlessly', async () => {
    assert.ok(adminToken, 'Admin token must exist');
    const res = await fetch(`${BACKEND_URL}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-traket-token': adminToken,
      },
      body: JSON.stringify({ action: 'refresh_token' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.token, 'Should return a newly signed refreshed token');
    assert.ok(data.expiresAt, 'Should return extended expiry date');
  });

  await t.test('6. Security Lockdown: Rejects unauthenticated WhatsApp dispatch calls', async () => {
    const res = await fetch(`${BACKEND_URL}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: '919820500159', text: 'Unauthorized probe' }),
    });
    assert.strictEqual(res.status, 401, 'Must reject unauthenticated calls with 401');
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes('Authentication required'));
  });

  await t.test('7. Security Lockdown: Rejects unauthenticated Reminder Logs calls', async () => {
    const res = await fetch(`${BACKEND_URL}/api/reminders/logs`);
    assert.strictEqual(res.status, 401, 'Must reject unauthenticated reminders access with 401');
  });

  await t.test('8. Authorized Reminder Access: Permits logged-in Admin to view logs', async () => {
    const res = await fetch(`${BACKEND_URL}/api/reminders/logs`, {
      headers: { 'x-traket-token': adminToken },
    });
    assert.strictEqual(res.status, 200, 'Authenticated admin must access reminder logs with 200 OK');
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(typeof data.logs === 'object');
  });

  await t.test('9. Team Management: Fetches employee roster for authenticated Admin', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-traket-token': adminToken,
      },
      body: JSON.stringify({ action: 'get_employees' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(Array.isArray(data.employees), 'Should return array of employees');
  });

  await t.test('10. Security Lockdown: Rejects unauthenticated employee roster access', async () => {
    const res = await fetch(`${BACKEND_URL}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get_employees' }),
    });
    assert.strictEqual(res.status, 401, 'Unauthenticated get_employees must return 401');
  });
});
