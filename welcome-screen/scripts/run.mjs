import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import 'dotenv/config';
const production = process.argv[2] === 'production';
if (!existsSync('.env')) {
  console.error(
    'Missing .env: copy .env.example and configure MySQL and teacher login.',
  );
  process.exit(1);
}
if (production && !existsSync('dist/server')) {
  console.error('Run npm run build before npm start.');
  process.exit(1);
}
const api = spawn(process.execPath, ['server/index.mjs'], {
  stdio: 'inherit',
  windowsHide: true,
});
let web;
try {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${process.env.API_PORT || 3001}/api/health`,
      );
      if (response.ok) break;
      if (attempt === 29) throw Error('MySQL connection failed');
    } catch (e) {
      if (attempt === 29) throw e;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  web = spawn(
    process.execPath,
    [
      'node_modules/vinext/dist/cli.js',
      production ? 'start' : 'dev',
      '--port',
      '3000',
      '--hostname',
      '0.0.0.0',
    ],
    { stdio: 'inherit', windowsHide: true },
  );
} catch (error) {
  console.error('Could not start the app:', error.message);
  api.kill();
  process.exit(1);
}
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  web?.kill();
  api.kill();
  process.exitCode = code;
}
api.on('exit', (code) => stop(code || 0));
web.on('exit', (code) => stop(code || 0));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
