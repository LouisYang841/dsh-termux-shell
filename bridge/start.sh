#!/data/data/com.termux/files/usr/bin/sh
set -eu
tool_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export PATH="${PREFIX:-/data/data/com.termux/files/usr}/bin:/system/bin"
termux-wake-lock >/dev/null 2>&1 || :
nohup setsid flock --close -n "$tool_dir/watch.lock" sh "$tool_dir/watch.sh" >> "$tool_dir/watch.log" 2>&1 </dev/null &
sleep 1
