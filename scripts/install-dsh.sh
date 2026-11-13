#!/bin/sh
set -eu
umask 077
source_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
dsh_home="${DSH_HOME:-$HOME/.dsh}"
plugin_dir="$dsh_home/dsh-go/plugins/local-termux-shell"
token_target="$dsh_home/dsh-go/termux-shell-token"
if [ ! -d /opt/dsh/node_modules/@deepseek-ai/dsh-tools ]; then
  echo 'Run this installer inside DSH Go Ubuntu.' >&2
  exit 1
fi
mkdir -p "$plugin_dir"
chmod 700 "$plugin_dir"
if [ "$#" -gt 0 ]; then
  if [ ! -s "$1" ]; then echo 'Pairing token file is missing or empty.' >&2; exit 1; fi
  node -e 'const fs=require("node:fs");const t=fs.readFileSync(process.argv[1],"utf8").trim();if(!/^[a-f0-9]{64}$/.test(t))throw Error("Expected a 64-character bridge token");fs.writeFileSync(process.argv[2],t+"\n",{mode:0o600});fs.chmodSync(process.argv[2],0o600)' "$1" "$token_target"
elif [ ! -s "$token_target" ]; then
  echo 'Usage: sh scripts/install-dsh.sh /path/to/private-token-file' >&2
  exit 1
fi
for file in package.json index.js client.mjs cordis.patch.yml; do
  if [ "$source_dir" != "$plugin_dir" ]; then cp "$source_dir/$file" "$plugin_dir/$file"; fi
done
mkdir -p "$plugin_dir/node_modules/@deepseek-ai"
ln -sfn /opt/dsh/node_modules/@deepseek-ai/dsh-tools "$plugin_dir/node_modules/@deepseek-ai/dsh-tools"
checker="$dsh_home/skills/dsh-go-plugin/kit/bin/check.mjs"
if [ -f "$checker" ]; then node "$checker" "$plugin_dir" --load; fi
dsh plugin --profile web add "$plugin_dir"
echo 'Installed termux_shell. Open a new chat or restart the engine if the tool is not visible.'
