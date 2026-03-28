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

  const isLocal = process.argv.includes('--local');
  const commandPrefix = isLocal ? 'npx wrangler d1 execute cryo-db --local --command=' : 'npx wrangler d1 execute cryo-db --remote --command=';

  const supabase = createClient(supabaseUrl, supabaseKey);

  let totalMigrated = 0;

  // Helper to safely escape/insert
  function safeInsert(table, fields, values) {
    const placeholders = fields.map(() => '?').join(', ');
    const sql = `INSERT OR REPLACE INTO ${table} (${fields.join(', ')}) VALUES (${placeholders});`;
    const escapedValues = values.map(v => typeof v === 'string' ? `'${v.replace(/'/g, \"''\")}'` : v);
    const fullCmd = commandPrefix + `'${sql.replace(/"/g, '\\"')} -- ${escapedValues.join(' ')}'`;
    execSync(fullCmd, { stdio: 'inherit' });
  }

  // Migrate profiles
  console.log('Migrating profiles...');
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  if (pErr) throw pErr;
  for (const profile of profiles) {
    safeInsert('profiles', ['id', 'first_name', 'last_name', 'public_key', 'encrypted_private_key', 'email', 'phone', 'notifications', 'created_at', 'updated_at'], [
      profile.id,
      profile.first_name || '',
      profile.last_name || '',
      JSON.stringify(profile.public_key || {}),
      JSON.stringify(profile.encrypted_private_key || {}),
      profile.email || '',
      profile.phone || '',
      JSON.stringify(profile.notifications || {}),
      profile.created_at,
      profile.updated_at
    ]);
    totalMigrated++;
  }

  // Migrate wallets
  console.log('Migrating wallets...');
  const { data: wallets } = await supabase.from('wallets').select('*');
  for (const wallet of wallets) {
    safeInsert('wallets', ['user_id', 'public_key', 'encrypted_private_key', 'verified', 'created_at', 'updated_at'], [
      wallet.user_id,
      JSON.stringify(wallet.public_key || {}),
      JSON.stringify(wallet.encrypted_private_key || {}),
      wallet.verified ? 1 : 0,
      wallet.created_at,
      wallet.updated_at
    ]);
    totalMigrated++;
  }

  // Migrate blocks
  console.log('Migrating blocks...');
  const { data: blocks } = await supabase.from('blocks').select('*');
  for (const block of blocks) {
    safeInsert('blocks', ['data', 'previous_hash', 'hash', 'created_at', 'user_id'], [
      JSON.stringify(block.data || {}),
      block.previous_hash || '',
      block.hash || '',
      block.created_at,
      block.user_id
    ]);
    totalMigrated++;
  }

  // Migrate contacts
  console.log('Migrating contacts...');
  const { data: contacts } = await supabase.from('contacts').select('*');
  for (const contact of contacts) {
    safeInsert('contacts', ['user_id', 'contact_user_id', 'name', 'address', 'email', 'label', 'public_key', 'created_at', 'updated_at'], [
      contact.user_id,
      contact.contact_user_id || null,
      contact.name || '',
      contact.address || '',
      contact.email || null,
      contact.label || null,
      JSON.stringify(contact.public_key || {}),
      contact.created_at,
      contact.updated_at
    ]);
    totalMigrated++;
  }

  console.log(`Migration complete. Total records migrated: ${totalMigrated}`);
  console.log(`Use: --local for local D1, or deploy first for remote.`);
}

migrate().catch(console.error);
