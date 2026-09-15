const { API_CONFIG } = require('../lib/config/api');

async function getOpenApiSpec() {
  const url = `${API_CONFIG.supabaseUrl}/rest/v1/`;
  console.log('Fetching from:', url);
  const res = await fetch(url, {
    headers: {
      'apikey': API_CONFIG.supabaseAnonKey,
      'Authorization': `Bearer ${API_CONFIG.supabaseAnonKey}`
    }
  });
  console.log('Response status:', res.status);
  const json = await res.json();
  console.log('Keys of JSON:', Object.keys(json));
  if (json.definitions) {
    for (const tableName in json.definitions) {
      console.log(`\nTable: "${tableName}"`);
      const props = json.definitions[tableName].properties || {};
      for (const prop in props) {
        console.log(`  └─ ${prop} (${props[prop].type || props[prop].format || ''})`);
      }
    }
  } else if (json.paths) {
    console.log('\nPaths in OpenAPI:');
    for (const path in json.paths) {
      console.log('  path:', path);
    }
  }
}

getOpenApiSpec().catch(console.error);
