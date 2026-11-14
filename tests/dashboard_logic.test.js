const test = require('node:test');
const assert = require('node:assert');

// 1. Vehicle Categorization Logic (Mirrors crm-dashboard/src/services/supabase.ts)
function categorizeVehicle(vehicleStr, cargoType) {
  if (!vehicleStr) return 'General';
  const v = String(vehicleStr).toLowerCase();
  const c = String(cargoType || '').toLowerCase();

  if (v.startsWith('tempo') || /\btempo\b/.test(v) || v.includes('pickup') || v.includes('ace') || v.includes('bolero')) {
    return 'Tempo';
  }
  if (v.includes('fcl 20') || v.includes('20 gp') || v.includes('20gp') || v.includes('20 flexi') || v.includes('flexi') || v.includes('20 tank') || v.includes('tank') || v.includes('tuskar')) {
    return 'FCL 20';
  }
  if (v.includes('fcl 40') || v.includes('40 hc') || v.includes('40hc') || v.includes('40 open') || v.includes('open top') || v.includes('40 fr') || v.includes('flat rack') || ((c.includes('import') || c.includes('export')) && (v.includes('3518 (24') || v.includes('4018 (29') || v.includes('amw (30')))) {
    return 'FCL 40';
  }
  if (v.includes('fcl') || c.includes('import') || c.includes('export')) {
    if (v.includes('20')) return 'FCL 20';
    return 'FCL 40';
  }
  if (v.startsWith('trailer') || v.includes('trailer') || v.includes('odc') || v.includes('over dimension') || v.includes('highbed') || v.includes('semi bed') || v.includes('low bed') || v.includes('3518 (27') || v.includes('4018 (33') || v.includes('amw (40')) {
    return 'Trailer / ODC';
  }
  if (v.startsWith('container') || v.includes('close body') || v.includes('mxl') || v.includes('sxl') || v.includes('32 ft container')) {
    return 'Container (Domestic)';
  }
  if (v.startsWith('truck') || /\btruck\b/.test(v) || v.includes('16 ft') || v.includes('19 ft') || v.includes('22 ft') || v.includes('24 ft') || v.includes('32 ft open') || v.includes('taurus') || v.includes('open body') || v.includes('flat bed')) {
    return 'Truck';
  }
  return 'General';
}

// 2. CSV Sanitizer (Mirrors App.tsx & ArchiveDesk.tsx)
function safeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

// 3. WhatsApp Phone Number Helper (Mirrors BookingsTable.tsx)
function getCleanPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

function getWhatsAppUrl(phone, text) {
  const cleanPhone = getCleanPhone(phone);
  if (!cleanPhone) return '#';
  return `https://wa.me/${cleanPhone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

test('Dashboard Logic & Isolation Test Suite', async (t) => {
  const sampleBookings = [
    { user_id: 'b1', phone: '9820500159', origin: 'Mumbai', destination: 'Delhi', vehicle_or_container: 'Tempo 1 MT', status: 'new', company_name: 'Alpha Ltd' },
    { user_id: 'b2', phone: '9876543210', origin: 'Chennai', destination: 'Bangalore', vehicle_or_container: '40 HC', status: 'quoted', company_name: '=cmd|calc!A0' },
    { user_id: 'b3', phone: '9123456789', origin: 'Kolkata', destination: 'Patna', vehicle_or_container: 'Trailer Highbed', status: 'confirmed', company_name: '+Beta Steels' },
  ];

  const sampleAssignments = {
    b1: { booking_id: 'b1', assigned_to: 'EMP001', assigned_at: '2026-11-10T10:00:00Z' },
    b2: { booking_id: 'b2', assigned_to: 'EMP002', assigned_at: '2026-11-11T12:00:00Z' },
    // b3 is unassigned
  };

  await t.test('Lead Isolation: Employee only sees assigned leads', () => {
    const role = 'employee';
    const currentEmployee = { employee_id: 'EMP002', name: 'Satu' };

    const visibleLeads = sampleBookings.filter((b) => {
      if (role === 'admin') return true;
      if (!currentEmployee) return false;
      const asgn = sampleAssignments[b.user_id];
      return asgn && asgn.assigned_to === currentEmployee.employee_id;
    });

    assert.strictEqual(visibleLeads.length, 1);
    assert.strictEqual(visibleLeads[0].user_id, 'b2');
  });

  await t.test('Lead Isolation: Admin sees all leads', () => {
    const role = 'admin';
    const currentEmployee = null;

    const visibleLeads = sampleBookings.filter((b) => {
      if (role === 'admin') return true;
      if (!currentEmployee) return false;
      const asgn = sampleAssignments[b.user_id];
      return asgn && asgn.assigned_to === currentEmployee.employee_id;
    });

    assert.strictEqual(visibleLeads.length, 3);
  });

  await t.test('Lead Isolation: Uninitialized employee sees ZERO leads (Fail-Closed)', () => {
    const role = 'employee';
    const currentEmployee = null; // Uninitialized

    const visibleLeads = sampleBookings.filter((b) => {
      if (role === 'admin') return true;
      if (!currentEmployee) return false;
      const asgn = sampleAssignments[b.user_id];
      return asgn && asgn.assigned_to === currentEmployee.employee_id;
    });

    assert.strictEqual(visibleLeads.length, 0, 'Must fail-closed to avoid data leaks');
  });

  await t.test('CSV Formula Injection Prevention (CWE-1236)', () => {
    assert.strictEqual(safeCsvCell('=cmd|calc!A0'), `"'=cmd|calc!A0"`);
    assert.strictEqual(safeCsvCell('+123456789'), ` "'+123456789"`.trim());
    assert.strictEqual(safeCsvCell('-SUM(A1:A10)'), ` "'-SUM(A1:A10)"`.trim());
    assert.strictEqual(safeCsvCell('@admin_user'), `"'@admin_user"`);
    assert.strictEqual(safeCsvCell('Normal Company "Pvt" Ltd'), `"Normal Company ""Pvt"" Ltd"`);
    assert.strictEqual(safeCsvCell(null), '""');
    assert.strictEqual(safeCsvCell(undefined), '""');
  });

  await t.test('CSV Export Lead Scoping: Employee cannot export full company database', () => {
    const currentEmployee = { employee_id: 'EMP002' };
    const isAdmin = false;

    const exportableBookings = isAdmin
      ? sampleBookings
      : sampleBookings.filter((b) => {
          const asgn = sampleAssignments[b.user_id];
          return asgn && asgn.assigned_to === currentEmployee.employee_id;
        });

    assert.strictEqual(exportableBookings.length, 1);
    assert.strictEqual(exportableBookings[0].user_id, 'b2');
  });

  await t.test('WhatsApp Phone & URL Formatter', () => {
    // 10-digit Indian mobile
    assert.strictEqual(getCleanPhone('9820500159'), '919820500159');
    // Formatted with spaces / dashes / plus
    assert.strictEqual(getCleanPhone('+91 98205-00159'), '919820500159');
    // Already has 91 prefix
    assert.strictEqual(getCleanPhone('919820500159'), '919820500159');
    // Generates valid link
    const url = getWhatsAppUrl('9820500159', 'Hello from Traket!');
    assert.ok(url.startsWith('https://wa.me/919820500159?text=Hello%20from%20Traket!'));
  });

  await t.test('Vehicle Categorization Accuracy', () => {
    assert.strictEqual(categorizeVehicle('Pickup 1 MT', 'Domestic'), 'Tempo');
    assert.strictEqual(categorizeVehicle('20 GP Container', 'Import'), 'FCL 20');
    assert.strictEqual(categorizeVehicle('40 HC', 'Export'), 'FCL 40');
    assert.strictEqual(categorizeVehicle('32 Ft SXL Close Body', 'Domestic'), 'Container (Domestic)');
    assert.strictEqual(categorizeVehicle('Trailer Highbed 3518', 'Domestic'), 'Trailer / ODC');
    assert.strictEqual(categorizeVehicle('16 Ft Truck', 'Domestic'), 'Truck');
  });

  await t.test('Archive Desk Date Resilience: Never crashes on empty inputs', () => {
    const customStartDate = '';
    const customEndDate = '';
    const now = new Date();

    const parsedStart = customStartDate ? new Date(`${customStartDate}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
    const start = isNaN(parsedStart.getTime()) ? new Date(now.getFullYear(), now.getMonth(), 1) : parsedStart;

    const parsedEnd = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : new Date();
    const end = isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;

    assert.ok(!isNaN(start.getTime()), 'Start date must be valid');
    assert.ok(!isNaN(end.getTime()), 'End date must be valid');
    assert.doesNotThrow(() => start.toISOString());
    assert.doesNotThrow(() => end.toISOString());
  });
});
