require('dotenv').config();
const db = require('../src/services/supabase');

async function testColumns() {
  const client = db.getClient();
  const { data, error } = await client.from('book_vehicle').select('*').limit(1);
  if (error) console.error('Error:', error);
  else console.log('Existing columns on book_vehicle:', Object.keys(data[0] || {}));
}

testColumns().catch(console.error);

