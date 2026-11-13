export const OFFLINE = 'Termux shell is unavailable. Termux may not be running. Open the Termux app (package com.termux), wait a few seconds for the shell bridge to start, return to DSH Go, and retry the same tool call. If it still fails, run ~/termux-shell-tool/start.sh inside Termux. DSH: tell the user this recovery step; if phone-control tools are available, open Termux and then retry once.';

export async function callTermux(args, { token, url = 'http://127.0.0.1:8766', signal, fetcher = fetch } = {}) {
  const timeout = args.timeout_seconds ?? 30;
  const abort = AbortSignal.timeout((timeout + 5) * 1000);
  const signals = signal ? AbortSignal.any([signal, abort]) : abort;
  let response;
  try {
    response = await fetcher(url + '/run', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(args), signal: signals,
    });
  } catch (error) {
    if (signal?.aborted) return { ok: false, error: 'Tool call cancelled.' };
    if (abort.aborted) return { ok: false, error: 'Termux command response timed out. Check its state before retrying; it may already have run.' };
    return { ok: false, error: OFFLINE, notification: 'Open Termux and retry.', code: 'TERMUX_UNAVAILABLE' };
  }
  if (response.status === 401) return { ok: false, error: 'Termux bridge token mismatch. Reinstall local-termux-shell using its setup command in Termux.' };
  try { return await response.json(); }
  catch { return { ok: false, error: 'Invalid response from Termux bridge. Restart ~/termux-shell-tool/start.sh.' }; }
}
