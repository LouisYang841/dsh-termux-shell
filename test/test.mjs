import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rootCommand } from '../bridge/policy.mjs';
import { callTermux, OFFLINE } from '../client.mjs';

test('everyday root tasks are permitted with literal arguments', () => {
  for (const args of [ ['id'], ['ls', '-la', '/data/user/0'], ['cat', '/data/local/tmp/example'],
    ['settings', 'put', 'system', 'screen_brightness', '120'],
    ['input', 'text', 'hello; $(id)'], ['pm', 'grant', 'org.example.app', 'android.permission.CAMERA'],
    ['am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'https://example.org'],
    ['cp', '/sdcard/Download/a', '/sdcard/Download/b'], ['rm', '/sdcard/Download/test-file'],
    ['chmod', '600', '/data/user/0/org.example.app/files/test'], ['ip', '-br', 'addr'] ]) {
    assert.ok(rootCommand(args).startsWith("'/system/bin/"));
  }
  assert.equal(rootCommand(['input', 'text', "a'b"]), "'/system/bin/input' 'text' 'a'\\''b'");
});
test('destructive commands, shell escapes and dangerous subcommands are blocked', () => {
  for (const args of [ ['rm', '-rf', '/'], ['rm', '-r', '/sdcard/Download'], ['dd', 'of=/dev/block/test'],
    ['mkfs.ext4', '/dev/block/test'], ['reboot'], ['setenforce', '0'], ['sh', '-c', 'id'],
    ['/system/bin/id'], ['toybox', 'rm', '-rf', '/'], ['find', '/', '-exec', 'sh'],
    ['pm', 'clear', 'org.example.app'], ['am', 'broadcast', '-a', 'android.intent.action.MASTER_CLEAR'],
    ['ip', 'link', 'set', 'wlan0', 'down'], ['cmd', 'power', 'reboot'],
    ['cp', '/sdcard/Download/a', '/system/build.prop'], ['chmod', '-R', '777', '/data'],
    ['cp', '--target-directory=/system', '/sdcard/Download/a'], ['rm', '/sdcard/Download/../../system/test'],
    ['am', 'force-stop', 'com.termux'], ['logcat', '-f', '/system/test'] ]) {
    assert.throws(() => rootCommand(args), /Root command blocked/, JSON.stringify(args));
  }
});
test('offline bridge tells DSH to open Termux and retry', async () => {
  const result = await callTermux({ command: 'id' }, { token: 'test', fetcher: async () => { throw new TypeError('fetch failed'); } });
  assert.equal(result.code, 'TERMUX_UNAVAILABLE');
  assert.equal(result.error, OFFLINE);
  assert.match(result.error, /Open the Termux app/);
  assert.match(result.error, /retry/);
});
test('auth and command failures are not reported as Termux being closed', async () => {
  const auth = await callTermux({}, { fetcher: async () => ({ status: 401 }) });
  assert.match(auth.error, /token mismatch/);
  const result = await callTermux({}, { fetcher: async () => ({ status: 400, json: async () => ({ ok: false, error: 'Root command blocked' }) }) });
  assert.equal(result.error, 'Root command blocked');
});
