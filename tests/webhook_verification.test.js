const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { handleVerification, isValidSignature, isConfiguredSecret } = require('../src/webhook/verify');

test('WhatsApp Webhook Verification & HMAC Signature Security Suite', async (t) => {
  await t.test('1. App Secret Validation: Detects placeholders vs real secrets', () => {
    assert.strictEqual(isConfiguredSecret('your_meta_app_secret'), false);
    assert.strictEqual(isConfiguredSecret('your_secret_here'), false);
    assert.strictEqual(isConfiguredSecret('placeholder'), false);
    assert.strictEqual(isConfiguredSecret(''), false);
    assert.strictEqual(isConfiguredSecret(null), false);
    assert.strictEqual(isConfiguredSecret(undefined), false);

    assert.strictEqual(isConfiguredSecret('a8f9c2d1e0b3456789abcdef01234567'), true);
    assert.strictEqual(isConfiguredSecret('sec_live_99238475892374'), true);
  });

  await t.test('2. Webhook Fallback Mode: Does NOT drop incoming messages when secret is placeholder', () => {
    const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account', entry: [] }));
    const signature = 'sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    // With placeholder secret, isValidSignature returns true (safe fallback mode)
    const valid = isValidSignature(rawBody, signature, 'your_meta_app_secret');
    assert.strictEqual(valid, true, 'Must allow webhook through in fallback mode to prevent message loss');
  });

  await t.test('3. Strict HMAC Verification: Passes with correct HMAC signature when real secret configured', () => {
    const realSecret = '9f7d2e4a6b8c0123456789abcdef0123';
    const payload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: '12345', changes: [{ value: { messages: [{ from: '919876543210', text: { body: 'Hello' } }] } }] }],
    });
    const rawBody = Buffer.from(payload, 'utf8');

    const expectedHash = crypto.createHmac('sha256', realSecret).update(rawBody).digest('hex');
    const validHeader = `sha256=${expectedHash}`;

    assert.strictEqual(isValidSignature(rawBody, validHeader, realSecret), true, 'Valid HMAC must pass');
  });

  await t.test('4. Strict HMAC Verification: Rejects tampered payloads or invalid signatures', () => {
    const realSecret = '9f7d2e4a6b8c0123456789abcdef0123';
    const rawBody = Buffer.from('{"tampered":true}', 'utf8');
    const forgedHeader = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

    assert.strictEqual(isValidSignature(rawBody, forgedHeader, realSecret), false, 'Tampered HMAC must be rejected');
    assert.strictEqual(isValidSignature(rawBody, null, realSecret), false, 'Missing signature must be rejected');
    assert.strictEqual(isValidSignature(rawBody, '', realSecret), false, 'Empty signature must be rejected');
  });

  await t.test('5. Meta Webhook Handshake (GET /webhook): Succeeds with matching verify token', () => {
    let statusCode = 0;
    let responseBody = '';

    const req = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'choose_any_random_string_here',
        'hub.challenge': '1158201244',
      },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      send(body) {
        responseBody = body;
        return this;
      },
      sendStatus(code) {
        statusCode = code;
        return this;
      },
    };

    handleVerification(req, res);
    assert.strictEqual(statusCode, 200, 'Handshake must return 200');
    assert.strictEqual(responseBody, '1158201244', 'Must echo challenge value');
  });

  await t.test('6. Meta Webhook Handshake (GET /webhook): Rejects invalid verify token with 403', () => {
    let statusCode = 0;
    const req = {
      query: {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong_token',
        'hub.challenge': '1158201244',
      },
    };
    const res = {
      sendStatus(code) {
        statusCode = code;
        return this;
      },
    };

    handleVerification(req, res);
    assert.strictEqual(statusCode, 403, 'Handshake must return 403 for wrong token');
  });
});
