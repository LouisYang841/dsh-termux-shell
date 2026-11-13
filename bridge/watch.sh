#!/data/data/com.termux/files/usr/bin/sh
set -eu
tool_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export PATH="${PREFIX:-/data/data/com.termux/files/usr}/bin:/system/bin"
while :; do
  pgrep -u "$(id -u)" -x sshd >/dev/null 2>&1 || sshd >> "$tool_dir/sshd.log" 2>&1
  if ! curl -fsS --max-time 2 http://127.0.0.1:8766/health >/dev/null 2>&1; then
    node "$tool_dir/server.mjs" >> "$tool_dir/bridge.log" 2>&1 &
  fi
  sleep 5
done
