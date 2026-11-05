require('dotenv').config();
const db = require('../src/services/supabase');

async function testFetch() {
  const client = db.getClient();

  const [bookingsRes, statusRes] = await Promise.all([
    client
      .from('book_vehicle')
      .select('*')
      .order('updated_at', { ascending: false }),
    client
      .from('lead_status')
      .select('*'),
  ]);

  console.log('Total bookings in book_vehicle:', bookingsRes.data.length);
  const recent = bookingsRes.data.slice(0, 5).map(b => ({
    user_id: b.user_id,
    phone: b.phone,
    contact_name: b.contact_name,
    approver_name: b.approver_name,
    origin: b.origin,
    destination: b.destination,
    vehicle_or_container: b.vehicle_or_container,
    updated_at: b.updated_at,
  }));
  console.log('Top 5 most recent in book_vehicle:\n', JSON.stringify(recent, null, 2));
}

testFetch().catch(console.error);

