import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

function run(cmd, args, { cwd, timeoutMs = 300_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (signal) return reject(new Error(`${cmd} ${args[0]} killed (${signal}) after ${timeoutMs / 1000}s`));
      if (code !== 0) return reject(new Error(`${cmd} ${args.join(' ')} failed (${code}): ${stderr.trim()}`));
      resolve(stdout);
    });
  });
}

async function withRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr;
}

const net = (args, opts) => withRetry(() => run('git', args, opts));

// core.longpaths: some benchmark repos (e.g. Juice Shop's Angular frontend)
// exceed Windows' 260-char path limit and silently check out incomplete.
const GIT_CONFIG = ['-c', 'core.longpaths=true', '-c', 'advice.detachedHead=false'];

export async function remoteHeadSha(url) {
  const out = await net([...GIT_CONFIG, 'ls-remote', url, 'HEAD'], { timeoutMs: 60_000 });
  const sha = out.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`Could not resolve HEAD for ${url}`);
  return sha;
}

export async function localHeadSha(dir) {
  return (await run('git', ['-C', dir, 'rev-parse', 'HEAD'])).trim();
}

/**
 * Ensures `dir` holds a shallow checkout of `url` at `sha` (or the remote's
 * default-branch HEAD when sha is null) and returns the checked-out SHA.
 * Reuses an existing checkout when it is already at the requested commit.
 */
export async function ensureCheckout(url, dir, sha = null) {
  if (existsSync(path.join(dir, '.git'))) {
    const current = await localHeadSha(dir).catch(() => null);
    const target = sha ?? (await remoteHeadSha(url));
    if (current === target) return current;
    try {
      await net([...GIT_CONFIG, '-C', dir, 'fetch', '--depth', '1', 'origin', target]);
      await run('git', [...GIT_CONFIG, '-C', dir, 'checkout', '--force', '--detach', 'FETCH_HEAD']);
      return await localHeadSha(dir);
    } catch {
      await rm(dir, { recursive: true, force: true });
    }
  }

  await mkdir(path.dirname(dir), { recursive: true });
  if (!sha) {
    await net([...GIT_CONFIG, 'clone', '--depth', '1', '--single-branch', '--no-tags', url, dir]);
    return localHeadSha(dir);
  }
  await mkdir(dir, { recursive: true });
  await run('git', [...GIT_CONFIG, '-C', dir, 'init', '-q']);
  await run('git', [...GIT_CONFIG, '-C', dir, 'remote', 'add', 'origin', url]);
  await net([...GIT_CONFIG, '-C', dir, 'fetch', '--depth', '1', 'origin', sha]);
  await run('git', [...GIT_CONFIG, '-C', dir, 'checkout', '--force', '--detach', 'FETCH_HEAD']);
  return localHeadSha(dir);
}
