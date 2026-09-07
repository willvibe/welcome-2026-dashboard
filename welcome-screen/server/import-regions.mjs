import { importRegions } from './geography.mjs';
import { pool } from './db.mjs';
try { console.log(JSON.stringify(await importRegions(), null, 2)); }
finally { await pool.end(); }
