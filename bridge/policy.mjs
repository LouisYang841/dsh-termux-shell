import path from 'node:path';

const read = new Set('id whoami uname uptime date pwd ls cat head tail stat readlink realpath df du ps top getprop dumpsys logcat grep wc sha256sum md5sum getenforce lsof netstat ss'.split(' '));
const file = new Set('cp mv mkdir touch chmod chown rm rmdir'.split(' '));
const reject = (reason) => { throw new Error(`Root command blocked: ${reason}`); };
const quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";

// A guard against accidents, not an isolation boundary. Never interpret root input as shell code.
export function rootCommand(argv) {
  if (!Array.isArray(argv) || !argv.length || argv.length > 256 ||
      argv.some(a => typeof a !== 'string' || a.includes('\0') || a.length > 8192)) reject('supply an argv array of strings.');
  const [name, ...args] = argv;
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) reject('use a plain Android command name, not a path or shell expression.');
  if (args.some(a => /MASTER_CLEAR|FACTORY_RESET|android\.intent\.action\.REBOOT/i.test(a))) reject('factory reset/reboot intent.');
  let permitted = read.has(name) || file.has(name);
  if (name === 'date' && args.some(a => !a.startsWith('+') && !['-u', '-R', '-I'].includes(a))) reject('changing the system clock.');
  if (name === 'logcat' && args.some(a => a === '-f' || a.startsWith('--file') || /^-f.+/.test(a))) reject('logcat file output; return output to the tool instead.');
  if (name === 'ip') permitted = ['addr', 'address', 'link', 'route', 'neigh', '-br', '-brief', '-s'].includes(args[0]) &&
    !args.some(a => ['add', 'del', 'delete', 'set', 'flush', 'replace', 'change', 'exec', 'netns', 'monitor', '-batch', '-b'].includes(a));
  if (name === 'settings') permitted = ['get', 'list', 'put', 'delete'].includes(args[0]) && ['system', 'secure', 'global'].includes(args[1]);
  if (name === 'pm') permitted = ['list', 'path', 'dump', 'grant', 'revoke', 'enable', 'disable', 'disable-user', 'install', 'install-existing'].includes(args[0]);
  if (name === 'am') permitted = ['start', 'start-activity', 'startservice', 'start-service', 'force-stop', 'broadcast', 'get-current-user'].includes(args[0]);
  if (['am', 'pm'].includes(name) && !['list', 'path', 'dump', 'get-current-user'].includes(args[0]) &&
      args.some(a => /^(com\.termux|io\.github\.ccch1mneyyy\.dsh_app)(\/|$)/.test(a))) reject('stopping or changing Termux/DSH itself.');
  if (name === 'input') permitted = ['tap', 'swipe', 'text', 'keyevent', 'press', 'roll', 'motionevent', 'draganddrop'].includes(args[0]);
  if (name === 'svc') permitted = ['wifi', 'data', 'bluetooth'].includes(args[0]) && ['enable', 'disable'].includes(args[1]) && args.length === 2;
  if (name === 'wm') permitted = ['size', 'density', 'reset', 'help'].includes(args[0]);
  if (name === 'cmd') permitted = args[0] === 'package' && ['list', 'path', 'resolve-activity', 'query-activities'].includes(args[1]);
  if (!permitted) reject(`${name} is not enabled. Shells/scripts, disk writes/formatting, reboot, mounts, SELinux changes and app-data wipes are disabled. Use normal mode for ordinary Termux commands.`);
  if (file.has(name)) {
    const flags = {
      cp: ['-r', '-R', '-a', '-p', '-f', '-n', '-v', '--'],
      mv: ['-f', '-n', '-v', '--'], mkdir: ['-p', '-v', '--'], touch: ['-c', '--'],
      chmod: ['-R', '-v', '--'], chown: ['-R', '-v', '--'],
      rm: ['-f', '-v', '--'], rmdir: ['-v', '--'],
    };
    if (args.some(a => a === '--reference' || a.startsWith('--reference='))) reject('reference option.');
    if (['rm', 'rmdir'].includes(name) && args.some(a => /^-.*[rR]/.test(a) || a.startsWith('--recursive'))) reject('recursive deletion. Delete individual files instead.');
    if (args.some(a => a.startsWith('-') && !flags[name].includes(a))) reject('unsupported file option; use simple, separate flags.');
    let operands = args.filter(a => !a.startsWith('-'));
    if (['chmod', 'chown'].includes(name)) operands = operands.slice(1);
    if (!operands.length) reject('explicit absolute file paths are required.');
    for (const operand of operands) {
      if (!operand.startsWith('/')) reject('use absolute paths for root file operations.');
      const p = path.posix.normalize(operand);
      // Daily file operations in shared storage, temporary files and individual app data.
      if (!/^\/(sdcard|storage\/emulated\/0|data\/local\/tmp)\/.+/.test(p) &&
          !/^\/data\/(data|user\/0|user_de\/0)\/[^/]+\/.+/.test(p)) reject(`protected path: ${p}`);
      if (/^\/data\/(data|user\/0)\/com\.termux(\/|$)/.test(p)) reject('Termux private files contain the bridge and its credentials.');
    }
  }
  return ['/system/bin/' + name, ...args].map(quote).join(' ');
}
