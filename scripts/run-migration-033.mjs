import https from 'https';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5aWRuaHR3bHhseXV3c3dhYXpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjIwMTI5NiwiZXhwIjoyMDkxNzc3Mjk2fQ.24VuW_WHpvDpK0KZi2e89O1m-L0wp7FZFlxmEU37wbk';

const sql = `DROP INDEX IF EXISTS idx_rate_limits_key;
ALTER TABLE rate_limits ADD CONSTRAINT uq_rate_limits_key UNIQUE (key);`;

const data = JSON.stringify({ sql });

const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/pyidnhtwlxlyuwswaazf/sql',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(body);
  });
});

req.on('error', (e) => console.error(`Error: ${e.message}`));
req.write(data);
req.end();
