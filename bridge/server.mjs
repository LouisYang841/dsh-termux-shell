import http from 'node:http';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { rootCommand } from './policy.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = process.env.PREFIX || '/data/data/com.termux/files/usr';
const HOME = process.env.HOME;
if (!HOME) throw new Error('HOME is required');
const token = readFileSync(path.join(DIR, 'token'), 'utf8').trim();
const MAX = 64 * 1024;
let active = 0;
function authenticated(req) {
  const actual = Buffer.from(req.headers.authorization || '');
  const expected = Buffer.from('Bearer ' + token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function run(args) {
  const mode = args.mode ?? 'normal';
  if (!['normal', 'su'].includes(mode)) throw new Error('mode must be normal or su');
  const timeout = args.timeout_seconds ?? 30;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 120) throw new Error('timeout_seconds must be 1–120');
  const cwd = args.cwd ?? HOME;
  if (typeof cwd !== 'string' || !cwd.startsWith('/') || cwd.includes('\0')) throw new Error('cwd must be an absolute directory');
  if (mode === 'normal' && !existsSync(cwd)) throw new Error('cwd must be an existing absolute Termux directory');
  let binary, params;
  if (mode === 'su') {
    const command = rootCommand(args.argv);
    binary = PREFIX + '/bin/su';
    const quotedCwd = "'" + cwd.replaceAll("'", "'\\''") + "'";
    params = ['-c', `cd ${quotedCwd} && exec /system/bin/timeout -s KILL ${timeout} ${command}`];
  } else {
    if (typeof args.command !== 'string' || !args.command.trim() || args.command.length > 32768 || args.command.includes('\0')) throw new Error('normal mode requires command');
    binary = PREFIX + '/bin/timeout';
    params = ['-s', 'KILL', String(timeout), PREFIX + '/bin/bash', '--noprofile', '--norc', '-c', args.command];
  }
  return new Promise((resolve) => {
    const child = spawn(binary, params, { cwd: mode === 'su' ? HOME : realpathSync(cwd), detached: true,
      env: { ...process.env, HOME, PREFIX, PATH: `${PREFIX}/bin:/system/bin:/system/xbin` }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', bytes = 0, truncated = false, killed = false;
    const kill = () => { killed = true; try { process.kill(-child.pid, 'SIGKILL'); } catch {} };
    const collect = (target) => (chunk) => {
      const remaining = MAX - bytes;
      bytes += chunk.length;
      const text = chunk.subarray(0, Math.max(0, remaining)).toString('utf8');
      if (target === 'stdout') stdout += text; else stderr += text;
      if (bytes > MAX) { truncated = true; kill(); }
    };
    child.stdout.on('data', collect('stdout'));
    child.stderr.on('data', collect('stderr'));
    const timer = setTimeout(kill, (timeout + 2) * 1000);
    child.once('error', error => { clearTimeout(timer); resolve({ ok: false, mode, stdout, stderr, error: error.message }); });
    child.once('close', (exit_code, signal) => {
      clearTimeout(timer);
      resolve({ ok: exit_code === 0 && !truncated, mode, exit_code, signal, stdout, stderr, truncated,
        timed_out: !truncated && (killed || exit_code === 124 || exit_code === 137 || signal === 'SIGKILL') });
    });
  });
}
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
const server = http.createServer(async (req, res) => {
  if (!['127.0.0.1:8766', 'localhost:8766'].includes(req.headers.host) || req.headers.origin) return json(res, 403, { error: 'Local non-browser clients only' });
  if (req.url === '/health' && req.method === 'GET') return json(res, 200, { service: 'termux-shell', version: 1 });
  if (!authenticated(req)) return json(res, 401, { error: 'Invalid bridge token' });
  if (req.url !== '/run' || req.method !== 'POST') return json(res, 404, { error: 'Not found' });
  if (active >= 4) return json(res, 429, { error: 'Four commands already running; retry shortly' });
  let body = '', counted = false;
  try {
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 40000) { json(res, 413, { error: 'Request too large' }); return; } }
    const args = JSON.parse(body);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Expected a JSON object');
    active++; counted = true;
    const result = await run(args);
    json(res, 200, result);
  } catch (error) { json(res, 400, { ok: false, error: error.message }); }
  finally { if (counted) active--; }
});
server.requestTimeout = 10000;
server.headersTimeout = 5000;
server.listen(8766, '127.0.0.1', () => console.log('Termux shell bridge: 127.0.0.1:8766'));
