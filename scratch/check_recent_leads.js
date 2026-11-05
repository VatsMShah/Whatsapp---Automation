require('dotenv').config();
const db = require('../src/services/supabase');

async function checkRecent() {
  const client = db.getClient();

  console.log('--- 1. LATEST ROWS IN users_master ---');
  const { data: users, error: err1 } = await client
    .from('users_master')
    .select('user_id, phone, state, updated_at, flow_type, data')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (err1) console.error('Error in users_master:', err1);
  else console.log(JSON.stringify(users, null, 2));

  console.log('\n--- 2. LATEST ROWS IN book_vehicle ---');
  const { data: books, error: err2 } = await client
    .from('book_vehicle')
    .select('user_id, phone, state, updated_at, origin, destination, vehicle_or_container, contact_name, approver_name, approver_phone')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (err2) console.error('Error in book_vehicle:', err2);
  else console.log(JSON.stringify(books, null, 2));
}

checkRecent().catch(console.error);

