const test = require('node:test');
const assert = require('node:assert');
const { processConversation } = require('../src/automation/processConversation');

test('WhatsApp Bot State Machine Test Suite', async (t) => {
  const dummyMaster = [{
    phone: '919820500159',
    state: 'contact_details',
    updated_at: new Date().toISOString(),
    data: JSON.stringify({
      loadingPin: '400001',
      unloadingPin: '110001',
      cargoType: 'Domestic',
      vehicleType: 'Truck',
      vehicleSubType: '16 Ft',
      material: 'Electronics',
      loadingDate: '25-11-2026'
    })
  }];

  await t.test('Contact Parsing: Two-line input extracts company and name', () => {
    const payload = {
      messages: [{
        from: '919820500159',
        type: 'text',
        text: { body: 'Reliance Logistics\nMukesh Ambani' }
      }]
    };
    const res = processConversation(payload, dummyMaster);
    const data = JSON.parse(res.data);
    assert.strictEqual(res.state, 'cta_menu');
    assert.strictEqual(data.company, 'Reliance Logistics');
    assert.strictEqual(data.contactName, 'Mukesh Ambani');
    assert.strictEqual(data.phone, '9820500159', 'Must fall back to sender phone');
  });

  await t.test('Contact Parsing: Single name input defaults company to Direct Transport Client', () => {
    const payload = {
      messages: [{
        from: '919820500159',
        type: 'text',
        text: { body: 'Vatsal Shah' }
      }]
    };
    const res = processConversation(payload, dummyMaster);
    const data = JSON.parse(res.data);
    assert.strictEqual(res.state, 'cta_menu');
    assert.strictEqual(data.contactName, 'Vatsal Shah');
    assert.strictEqual(data.company, 'Direct Transport Client');
    assert.strictEqual(data.phone, '9820500159');
  });

  await t.test('Contact Parsing: Comma-separated input parses company and contact', () => {
    const payload = {
      messages: [{
        from: '919820500159',
        type: 'text',
        text: { body: 'Adani Ports, Gautam' }
      }]
    };
    const res = processConversation(payload, dummyMaster);
    const data = JSON.parse(res.data);
    assert.strictEqual(res.state, 'cta_menu');
    assert.strictEqual(data.company, 'Adani Ports');
    assert.strictEqual(data.contactName, 'Gautam');
    assert.strictEqual(data.phone, '9820500159');
  });

  await t.test('Greeting Reset: Resets conversation to main_menu on Hi / Hello / Start / Namaste', () => {
    const greetings = ['hi', 'Hi', 'hello', 'HELLO', 'namaste', 'start', 'restart', 'menu'];
    for (const g of greetings) {
      const payload = {
        messages: [{
          from: '919820500159',
          type: 'text',
          text: { body: g }
        }]
      };
      const res = processConversation(payload, dummyMaster);
      assert.strictEqual(res.state, 'main_menu', `Greeting "${g}" must transition to main_menu`);
      assert.ok(res.response.includes('Welcome to Traket Transport'));
    }
  });

  await t.test('Media / Location Resilience: Does not crash on location pin payload', () => {
    const payload = {
      messages: [{
        from: '919820500159',
        type: 'location',
        location: { latitude: 19.076, longitude: 72.8777, name: 'Mumbai CFS', address: 'Bhiwandi, Maharashtra' }
      }]
    };
    assert.doesNotThrow(() => processConversation(payload, dummyMaster));
  });
});
