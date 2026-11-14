const test = require('node:test');
const assert = require('node:assert');
const { verifyJwt, signJwt } = require('../src/routes/auth');

test('Auth & Security Test Suite', async (t) => {
  await t.test('JWT Engine: Signs and verifies admin claims accurately', () => {
    const claims = {
      sub: 'adm-001',
      role: 'admin',
      username: 'admin',
      email: 'admin@traket.in',
    };
    const { token, expiresAt } = signJwt(claims, 3600);
    assert.ok(token, 'Token should be generated');
    assert.ok(expiresAt, 'Expiry ISO string should be returned');

    const verified = verifyJwt(token);
    assert.ok(verified, 'Token should verify successfully');
    assert.strictEqual(verified.sub, 'adm-001');
    assert.strictEqual(verified.role, 'admin');
    assert.strictEqual(verified.email, 'admin@traket.in');
  });

  await t.test('JWT Engine: Signs and verifies employee claims accurately', () => {
    const claims = {
      sub: 'EMP002',
      role: 'employee',
      employee_id: 'EMP002',
      email: 'satu@traket.in',
    };
    const { token } = signJwt(claims, 3600);
    const verified = verifyJwt(token);
    assert.ok(verified);
    assert.strictEqual(verified.sub, 'EMP002');
    assert.strictEqual(verified.role, 'employee');
  });

  await t.test('JWT Engine: Rejects expired tokens', () => {
    const claims = { sub: 'adm-001', role: 'admin' };
    // Issue token expired 10 seconds ago
    const { token } = signJwt(claims, -10);
    const verified = verifyJwt(token);
    assert.strictEqual(verified, null, 'Expired token must return null');
  });

  await t.test('JWT Engine: Rejects tampered tokens', () => {
    const claims = { sub: 'EMP002', role: 'employee' };
    const { token } = signJwt(claims, 3600);
    const parts = token.split('.');
    // Tamper with payload (modify role to admin)
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: 'EMP002', role: 'admin', iss: 'traket-crm-auth', exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const verified = verifyJwt(tamperedToken);
    assert.strictEqual(verified, null, 'Tampered signature must be rejected');
  });

  await t.test('JWT Engine: Rejects garbage/null/undefined inputs gracefully', () => {
    assert.strictEqual(verifyJwt(''), null);
    assert.strictEqual(verifyJwt(null), null);
    assert.strictEqual(verifyJwt(undefined), null);
    assert.strictEqual(verifyJwt('invalid.token'), null);
    assert.strictEqual(verifyJwt('header.payload.sig.extra'), null);
  });
});
