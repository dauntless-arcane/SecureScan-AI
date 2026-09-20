#!/usr/bin/env node
// Kills whatever process is listening on the backend port (default 4000),
// so a crashed/orphaned `node src/server.js` doesn't block the next `npm run dev`.
import { execSync } from 'node:child_process';

const port = process.argv[2] || process.env.PORT || '4000';

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function killWindows(port) {
  let output;
  try {
    output = run(`netstat -ano | findstr :${port}`);
  } catch {
    return false;
  }

  const pids = new Set();
  for (const line of output.split('\n')) {
    const parts = line.trim().split(/\s+/);
    const localAddress = parts[1];
    const pid = parts[parts.length - 1];
    if (localAddress?.endsWith(`:${port}`) && pid && /^\d+$/.test(pid) && pid !== '0') {
      pids.add(pid);
    }
  }

  if (pids.size === 0) return false;

  for (const pid of pids) {
    try {
      run(`taskkill /PID ${pid} /F`);
      console.log(`Killed PID ${pid} on port ${port}`);
    } catch (err) {
      console.error(`Failed to kill PID ${pid}: ${err.message}`);
    }
  }
  return true;
}

function killPosix(port) {
  let pids;
  try {
    pids = run(`lsof -ti tcp:${port}`);
  } catch {
    return false;
  }

  if (!pids) return false;

  for (const pid of pids.split('\n').filter(Boolean)) {
    try {
      run(`kill -9 ${pid}`);
      console.log(`Killed PID ${pid} on port ${port}`);
    } catch (err) {
      console.error(`Failed to kill PID ${pid}: ${err.message}`);
    }
  }
  return true;
}

const killed = process.platform === 'win32' ? killWindows(port) : killPosix(port);

if (!killed) {
  console.log(`No process found listening on port ${port}.`);
}
