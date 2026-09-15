require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

console.log('ENV KEYS AVAILABLE:');
Object.keys(process.env).filter(k => k.includes('SUPABASE') || k.includes('KEY') || k.includes('SECRET') || k.includes('DATABASE') || k.includes('POSTGRES')).forEach(k => {
  const val = process.env[k];
  console.log(`  ${k} = ${val ? val.substring(0, 15) + '...' : 'EMPTY'}`);
});
