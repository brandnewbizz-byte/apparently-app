import pg from 'pg';
import { readFileSync } from 'fs';

// Never hard-code the database password. Provide the connection string via
// the environment, e.g. (Supabase → Project Settings → Database → Connection string):
//   SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:6543/postgres' \
//     node scripts/apply-migration.mjs supabase/migrations/0XX_name.sql
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Set SUPABASE_DB_URL to your Supabase Postgres connection string.');
  process.exit(1);
}

const file = process.argv[2];
if (!file) { console.error('usage: node apply-migration.mjs <file.sql>'); process.exit(1); }

const sql = readFileSync(file, 'utf8');
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15000 });
await client.connect();
console.log('connected');

// Run the whole file as one batch (migration is wrapped in begin/commit).
try {
  await client.query(sql);
  console.log('APPLIED OK:', file);
} catch (e) {
  console.error('FAILED:', e.message);
  await client.end();
  process.exit(1);
}

// Verify triggers/functions exist
const check = await client.query(`
  select
    (select count(*) from pg_trigger where tgname in ('trg_notifications_push','trg_messages_push')) as triggers,
    (select count(*) from pg_proc where proname in ('dispatch_push','notify_on_notification_insert','notify_on_message_insert')) as functions,
    (select count(*) from pg_extension where extname='pg_net') as pg_net
`);
console.log('VERIFY:', JSON.stringify(check.rows[0]));
await client.end();
process.exit(0);
