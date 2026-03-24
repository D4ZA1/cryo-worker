const { createClient } = require('@supabase/supabase-js');
const { execSync } = require('child_process');

/**
 * Data Migration Script: Supabase -> Cloudflare D1 local
 * Usage: node scripts/migrate-data.js --local
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY env vars
 * D1 local: wrangler d1 execute cryo-db --local --command='...'
 */

async function migrate() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Migrate profiles
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('*');
  if (pErr) throw pErr;

  for (const profile of profiles) {
    const sql = `INSERT OR REPLACE INTO profiles (id, first_name, last_name, public_key, encrypted_private_key, email, phone, notifications, created_at, updated_at) VALUES (
      '${profile.id}',
      '${profile.first_name || ''}',
      '${profile.last_name || ''}',
      '${JSON.stringify(profile.public_key || {})}',
      '${JSON.stringify(profile.encrypted_private_key || {})}',
      '${profile.email || ''}',
      '${profile.phone || ''}',
      '${JSON.stringify(profile.notifications || {})}',
      '${profile.created_at}',
      '${profile.updated_at}'
    );`;
    execSync(`npx wrangler d1 execute cryo-db --local --command="${sql.replace(/"/g, '\\"')}"`);
  }

  // Similar for wallets, blocks, contacts...

  console.log('Migration complete. Review logs for errors.');
}

migrate().catch(console.error);
