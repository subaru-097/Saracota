require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function getSwagger() {
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const swagger = await res.json();
    console.log('Response:', swagger);
  } catch (e) {
    console.error('Error fetching swagger:', e);
  }
}

getSwagger();
