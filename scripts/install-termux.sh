#!/data/data/com.termux/files/usr/bin/sh
set -eu
umask 077
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
target_dir="$HOME/termux-shell-tool"
for tool in node sshd curl flock setsid pgrep; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo 'Install dependencies in Termux: pkg install nodejs openssh curl util-linux procps' >&2
    exit 1
  fi
done
if [ -e "$target_dir/server.mjs" ]; then
  echo "$target_dir already contains a bridge. Keep the existing running setup, or stop it and move the directory aside before installing." >&2
  exit 1
fi
mkdir -p "$target_dir"
chmod 700 "$target_dir"
for file in server.mjs policy.mjs start.sh watch.sh; do cp "$source_dir/bridge/$file" "$target_dir/$file"; done
chmod 700 "$target_dir"/*.sh
node -e 'const fs=require("node:fs"),crypto=require("node:crypto"); fs.writeFileSync(process.argv[1],crypto.randomBytes(32).toString("hex")+"\n",{mode:0o600,flag:"wx"})' "$target_dir/token"
ssh-keygen -A
startup='[ ! -x "$HOME/termux-shell-tool/start.sh" ] || "$HOME/termux-shell-tool/start.sh"'
if ! grep -Fq "$startup" "$HOME/.bashrc" 2>/dev/null; then
  printf '\n# DSH Termux shell bridge and SSH watchdog\n%s\n' "$startup" >> "$HOME/.bashrc"
fi
"$target_dir/start.sh"
echo "Bridge started. Pairing token file: $target_dir/token (keep it private)."
echo 'Transfer that file privately into DSH Ubuntu, then run scripts/install-dsh.sh /path/to/token.'
