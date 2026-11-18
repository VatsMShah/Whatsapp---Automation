const test = require('node:test');
const assert = require('node:assert');
const { maskPhone, maskName, maskEmail } = require('../src/utils/masking');

test('Customer PII Masking Security & Display Suite', async (t) => {
  await t.test('1. Phone Number Masking: Shows only first 2 digits, masks remaining 8', () => {
    // Standard Indian 10-digit number
    assert.strictEqual(maskPhone('9820500159'), '+91 98••••••••');
    // Number with +91 country code
    assert.strictEqual(maskPhone('+91 72086 72150'), '+91 72••••••••');
    // Number with 91 prefix without plus
    assert.strictEqual(maskPhone('917208672150'), '+91 72••••••••');
    // Number with whitespace and dashes
    assert.strictEqual(maskPhone('+91-99749-00185'), '+91 99••••••••');
    // Edge cases: null, empty, short
    assert.strictEqual(maskPhone(null), '—');
    assert.strictEqual(maskPhone(''), '—');
    assert.strictEqual(maskPhone('12'), '12');
  });

  await t.test('2. Contact Name Masking: Shows only first 2 letters, masks rest', () => {
    // Single word name
    assert.strictEqual(maskName('Jhatu'), 'Jh•••');
    // Multi-word name
    assert.strictEqual(maskName('Baraiya nirubhai'), 'Ba••••••••••••••');
    assert.strictEqual(maskName('Chetan lodaya'), 'Ch•••••••••••');
    // Name in all caps
    assert.strictEqual(maskName('HONEY'), 'HO•••');
    // Phone number entered as name (from WhatsApp profile)
    assert.strictEqual(maskName('8879774616'), '88••••••••');
    // Short name (2 chars)
    assert.strictEqual(maskName('Al'), 'Al');
    // Edge cases: null, empty
    assert.strictEqual(maskName(null), '—');
    assert.strictEqual(maskName(''), '—');
  });

  await t.test('3. Email Masking: Shows first 2 letters of user, preserves domain', () => {
    // Standard corporate email: "mukesh.ambani" (13 chars) -> "mu" + 11 bullets
    assert.strictEqual(maskEmail('mukesh.ambani@reliance.com'), 'mu•••••••••••@reliance.com');
    // Short username: "support" (7 chars) -> "su" + 5 bullets
    assert.strictEqual(maskEmail('support@traket.in'), 'su•••••@traket.in');
    // Gmail address: "john" (4 chars) -> "jo" + 2 bullets
    assert.strictEqual(maskEmail('john@gmail.com'), 'jo••@gmail.com');
    // Very short username (<= 2 chars)
    assert.strictEqual(maskEmail('al@traket.in'), 'al@traket.in');
    // Edge cases: null, empty, without @
    assert.strictEqual(maskEmail(null), '—');
    assert.strictEqual(maskEmail(''), '—');
    assert.strictEqual(maskEmail('invalidemail'), 'in••••••••••');
  });

  await t.test('4. Admin Eye Toggle Logic: Controls masked vs unmasked state', () => {
    const sampleLead = {
      name: 'Mukesh Ambani',
      phone: '+91 72086 72150',
      email: 'mukesh@reliance.com',
    };

    // When showPii is false (default)
    const showPiiOff = false;
    const displayNameOff = showPiiOff ? sampleLead.name : maskName(sampleLead.name);
    const displayPhoneOff = showPiiOff ? sampleLead.phone : maskPhone(sampleLead.phone);
    const displayEmailOff = showPiiOff ? sampleLead.email : maskEmail(sampleLead.email);

    assert.strictEqual(displayNameOff, 'Mu•••••••••••');
    assert.strictEqual(displayPhoneOff, '+91 72••••••••');
    assert.strictEqual(displayEmailOff, 'mu••••@reliance.com');

    // When showPii is true (Admin toggled Eye ON)
    const showPiiOn = true;
    const displayNameOn = showPiiOn ? sampleLead.name : maskName(sampleLead.name);
    const displayPhoneOn = showPiiOn ? sampleLead.phone : maskPhone(sampleLead.phone);
    const displayEmailOn = showPiiOn ? sampleLead.email : maskEmail(sampleLead.email);

    assert.strictEqual(displayNameOn, 'Mukesh Ambani');
    assert.strictEqual(displayPhoneOn, '+91 72086 72150');
    assert.strictEqual(displayEmailOn, 'mukesh@reliance.com');
  });
});
