import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'db.pyidnhtwlxlyuwswaazf.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Adm100%2525%401198',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    await client.connect();
    console.log('Connected to database');

    await client.query(`DROP INDEX IF EXISTS idx_rate_limits_key;`);
    console.log('Dropped old partial index');

    await client.query(`ALTER TABLE rate_limits ADD CONSTRAINT uq_rate_limits_key UNIQUE (key);`);
    console.log('Added unique constraint on key column');

    console.log('Migration 033 applied successfully');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

runMigration();
