import { cp, access } from 'node:fs/promises';

const standalone = new URL('../.next/standalone/', import.meta.url);
const server = new URL('server.js', standalone);
try {
  await access(server);
} catch {
  console.error('Run npm run build before npm start.');
  process.exit(1);
}
// Next.js standalone omits these assets; Docker copies them in its runtime stage.
await cp(new URL('../.next/static/', import.meta.url), new URL('.next/static/', standalone), { recursive: true });
await cp(new URL('../public/', import.meta.url), new URL('public/', standalone), { recursive: true });
process.env.HOSTNAME = '0.0.0.0';
await import(server.href);
