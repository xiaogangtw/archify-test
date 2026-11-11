import { readFile } from 'node:fs/promises';
const password=(await readFile('/run/secrets/db_password','utf8')).trim();
process.env.DATABASE_URL=`postgresql://archify:${encodeURIComponent(password)}@postgres:5432/archify_test`;
await import('./database.integration.ts');
