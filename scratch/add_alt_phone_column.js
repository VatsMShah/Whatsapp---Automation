require('dotenv').config();

async function addAlternatePhoneColumn() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_ID || 'njmzdeddmangggeukjce';

  if (!token) {
    console.error('No SUPABASE_ACCESS_TOKEN found.');
    return;
  }

  const sql = `
    ALTER TABLE public.book_vehicle
      ADD COLUMN IF NOT EXISTS alternate_phone TEXT DEFAULT '';
  `;

  console.log(`Running SQL on project ${projectRef}...`);
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.json();
  console.log('Response status:', res.status);
  console.log('Response body:', body);
}

addAlternatePhoneColumn().catch(console.error);

