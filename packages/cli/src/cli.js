import { cmdAdd, cmdAgent, cmdClean, cmdDoctor, cmdInit, cmdInstall, cmdProfile, cmdRemove, cmdRun } from './commands.js';

export async function main(args) {
  const command = args[0];
  const rest = args.slice(1);
  let status;
  if (!command || ['-h', '--help', 'help'].includes(command)) status = help();
  else if (command === '--version' || command === 'version') status = version();
  else if (command === 'init') status = cmdInit(rest);
  else if (command === 'install') status = cmdInstall(rest);
  else if (command === 'add') status = cmdAdd(rest);
  else if (command === 'remove') status = cmdRemove(rest);
  else if (command === 'doctor') status = cmdDoctor(rest);
  else if (command === 'run') status = cmdRun(rest);
  else if (command === 'agent') status = cmdAgent(rest);
  else if (command === 'profile') status = cmdProfile(rest);
  else if (command === 'clean') status = cmdClean(rest);
  else throw new Error(`unknown command: ${command}`);
  if (typeof status === 'number') process.exitCode = status;
}

function help() {
  console.log(`AgentDeps (mad)\n\nUsage:\n  mad init [--name <name>] [--force]\n  mad add <module...> [--profile <profile>]\n  mad remove <module...> [--profile <profile>]\n  mad install [--profile <profile>]\n  mad doctor [--profile <profile>] [--session] [--json]\n  mad run --profile <profile> -- <command>\n  mad agent status [--profile <profile>] [--json]\n  mad agent capabilities [--profile <profile>]\n  mad agent explain <module>\n  mad agent apply --session [--profile <profile>] [--enable <module>] [--disable <module>]\n  mad agent bootstrap [--profile <profile>]\n  mad agent restart-command [--profile <profile>]\n  mad profile enable|disable <profile> <module>\n  mad clean [--profile <profile>]\n`);
}

function version() {
  console.log('0.0.1');
}
