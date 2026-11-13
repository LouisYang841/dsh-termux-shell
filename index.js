import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { callTermux } from './client.mjs';

export const name = 'local-termux-shell';
export const inject = ['tools'];
export function apply(ctx) {
  let token = process.env.TERMUX_SHELL_TOKEN?.trim();
  if (!token) {
    const tokenPath = process.env.TERMUX_SHELL_TOKEN_FILE || path.join(process.env.DSH_HOME || path.join(homedir(), '.dsh'), 'dsh-go', 'termux-shell-token');
    try { token = readFileSync(tokenPath, 'utf8').trim(); }
    catch { throw new Error('Termux pairing token is missing. Run scripts/install-dsh.sh with a private token file before enabling this plugin.'); }
  }
  if (!token) throw new Error('Termux pairing token is empty.');
  ctx.tools.register(defineTool({
    name: 'termux_shell',
    description: 'Run commands in the real Termux environment on this Android phone. normal: command is a Bash command. su: argv is an Android command with separate arguments, e.g. ["id"], ["settings","get","system","screen_brightness"], ["pm","grant","app.package","android.permission.CAMERA"]. Root mode permits daily administration with destructive-operation guardrails. Root mode never interprets shell syntax; use separate calls for multiple root commands. If TERMUX_UNAVAILABLE, open Termux (com.termux), wait for startup, and retry once; tell the user if manual opening is needed. Normal mode is a trusted full shell, not a sandbox; use su mode for root work and respect its blocks.',
    parameters: {
      mode: { type: 'string', enum: ['normal', 'su'], description: 'Default normal.' },
      command: { type: 'string', description: 'Bash command for normal mode.' },
      argv: { type: 'array', items: { type: 'string' }, description: 'Root command and literal arguments for su mode; no shells, chaining, expansion or scripts.' },
      cwd: { type: 'string', description: 'Absolute directory in Termux. Default Termux home.' },
      timeout_seconds: { type: 'integer', description: '1–120 seconds; default 30.' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
      presentationMeta: (_args, value) => value.code === 'TERMUX_UNAVAILABLE' ? {
        'dsh-go/view': { type: 'callout', tone: 'warn', text: 'Open Termux and retry. 打开 Termux，等待几秒后重试。' },
      } : {},
    },
    timeoutMs: 130000,
    isConcurrencySafe: () => false,
    execute: (args, exec) => callTermux(args, { token, signal: exec.signal }),
  }));
}
