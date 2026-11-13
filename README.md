# DSH Go Termux Shell

A small DSH Go plugin that runs commands in the real Termux environment on the same
Android device. It provides `termux_shell` with normal Bash and guarded `su` modes.
If Termux is unavailable, the tool shows a warning and asks DSH to open Termux and retry.

The bridge uses authenticated HTTP on `127.0.0.1:8766`. A watchdog checks every five
seconds and restarts the bridge and Termux's existing SSH server if they exit. Termux
startup requests a wake lock; Android force-stop or process killing still stops services.

## Requirements

- Termux with Node.js, OpenSSH, curl, util-linux and procps.
- DSH Go's Ubuntu environment with the DSH runtime at `/opt/dsh`.
- Working Android `su` authorization for Termux if root mode is needed.
- The DSH API target is `>=0.2.1-rc.2 <0.3.0-0`.

## Install

Clone this repository in Termux:

```sh
git clone https://github.com/LouisYang841/dsh-termux-shell.git
cd dsh-termux-shell
pkg install nodejs openssh curl util-linux procps
sh scripts/install-termux.sh
```

This creates a **new random private token** at `~/termux-shell-tool/token` and starts the
services. The installer refuses to overwrite an existing bridge installation. It retains
your existing SSH settings and authentication; configure an SSH key separately if needed.

Clone this repository inside DSH Go's Ubuntu environment too. Privately transfer the
token file into that environment, then run:

```sh
sh scripts/install-dsh.sh /path/to/private-token-file
```

Termux's private home is not visible inside DSH Ubuntu. Transfer the token using a private
file transfer or a local file accessible to both apps; remove any temporary shared copy
after pairing. Do not paste it into public issues or commit it. This repository ships no
credentials, SSH keys, device-specific installation URLs, or paired archives.

The installer stores the token outside the plugin checkout at
`~/.dsh/dsh-go/termux-shell-token`, validates the plugin with DSH Go's checker if available,
and registers it using `dsh plugin --profile web add`. Open a new chat or restart the
DSH engine if `termux_shell` is not visible.

For custom deployments the plugin also accepts `TERMUX_SHELL_TOKEN_FILE` or
`TERMUX_SHELL_TOKEN` in the DSH engine environment.

## Usage

Normal Termux Bash:

```json
{"mode":"normal","command":"id; pwd","timeout_seconds":30}
```

Root with literal arguments:

```json
{"mode":"su","argv":["id"]}
```

```json
{"mode":"su","argv":["settings","get","system","screen_brightness"]}
```

```json
{"mode":"su","argv":["ls","-la"],"cwd":"/data/user/0"}
```

Root mode supports common diagnostic commands, app launches, app permission changes,
package enable/disable/install, Android settings, input, network toggles, display controls,
and common file operations in shared storage, temporary files and individual app data.
It blocks recursive deletion, formatting/raw block writes, app-data wipes, reboot, mounts,
SELinux changes, shell/script wrappers, and protected file targets. Root syntax uses an
`argv` array: pipes, substitutions and chaining are not interpreted. Use separate calls.
See [`bridge/policy.mjs`](bridge/policy.mjs) for the exact rules.

These are accident guardrails for a **trusted agent, not a security sandbox**. Normal mode
is a full shell as the Termux user, which may already have `su` access; an agent must not
use normal mode to bypass root-mode refusals. Symlinks and Android service operations
are not comprehensively confined. Protect the pairing token accordingly.

Calls default to 30 seconds, with a 120-second maximum and a combined 64 KiB output cap.
Commands are noninteractive. Background jobs are not supervised. The bridge accepts up
to four simultaneous commands; the plugin declares calls unsafe for concurrent scheduling.

## Recovery and maintenance

On connection failure the DSH tool returns `TERMUX_UNAVAILABLE`, a warning card, and
instructions to open `com.termux`, wait a few seconds, then retry once. It distinguishes
authentication failures and response timeouts from an unavailable app.

In Termux, start services manually with `~/termux-shell-tool/start.sh`.
Release the wake lock when background access is no longer needed: `termux-wake-unlock`.
Logs live beside the bridge as `bridge.log`, `watch.log`, and `sshd.log`.
Remove the DSH plugin with `dsh plugin --profile web remove local-termux-shell`.

## Tests

```sh
npm test
```

Tests cover common root operations, destructive operations, literal argument quoting,
offline recovery messages and authentication failure reporting. The original local setup
was additionally tested with live normal/root commands, timeout enforcement, watchdog
recovery, and the DSH Go plugin checker. Public installation scripts have syntax checks;
they have not been used to overwrite an existing paired installation.
