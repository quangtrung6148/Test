import { spawnSync } from 'node:child_process';

const action = process.argv[2];
if (!['install', 'build', 'typecheck', 'lint', 'test'].includes(action)) {
  throw new Error('Expected install, build, typecheck, lint or test');
}
for (const app of ['backend', 'service', 'frontend']) {
  console.log(`\n${app}: ${action}`);
  const args = action === 'install' ? ['ci'] : ['run', action];
  // npm.cmd needs a shell on Windows. Arguments here are fixed, never user input.
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: new URL(`../${app}/`, import.meta.url), stdio: 'inherit', shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
