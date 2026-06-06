import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cli = path.join(root, 'bin/mad.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentdeps-smoke-'));

function run(args, options = {}) {
  const cwd = options.cwd || tmp;
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', ...options });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`command failed: mad ${args.join(' ')}`);
  }
  return result.stdout.trim();
}

function fail(args, options = {}) {
  const cwd = options.cwd || tmp;
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', ...options });
  if (result.status === 0) {
    console.error(result.stdout);
    throw new Error(`command unexpectedly succeeded: mad ${args.join(' ')}`);
  }
  return `${result.stdout}\n${result.stderr}`;
}

run(['init', '--name', 'smoke']);
run(['add', 'tuist', '--profile', 'light']);
run(['remove', 'tuist', '--profile', 'light']);
fail(['profile', 'enable', 'light', 'no-such-module']);
fail(['agent', 'apply', '--session', '--profile', 'ios', '--enable', 'no-such-module']);

const victim = path.join(os.tmpdir(), `agentdeps-victim-${Date.now()}`);
fs.mkdirSync(victim);
fail(['clean', '--profile', '../../../victim']);
if (!fs.existsSync(victim)) throw new Error('unsafe clean removed a sibling directory');
fs.rmSync(victim, { recursive: true, force: true });

run(['install', '--profile', 'light']);
run(['install', '--profile', 'ios']);
const lightMismatch = fail(['doctor', '--profile', 'light']);
if (!lightMismatch.includes('lockfile profile mismatch')) throw new Error('doctor did not catch single-lock profile mismatch');
run(['agent', 'status', '--profile', 'ios']);
run(['agent', 'capabilities', '--profile', 'ios']);
run(['agent', 'explain', 'tuist']);
run(['agent', 'apply', '--session', '--profile', 'ios', '--enable', 'tuist', '--disable', 'app-release']);
const doctor = run(['doctor', '--profile', 'ios', '--session']);
run(['agent', 'bootstrap', '--profile', 'ios']);
run(['agent', 'restart-command', '--profile', 'ios']);

const lockfile = path.join(tmp, '.agentdeps/agentdeps.lock.toml');
const savedLock = fs.readFileSync(lockfile, 'utf8');
fs.rmSync(lockfile);
fail(['run', '--profile', 'ios', '--', process.execPath, '-e', 'process.exit(0)']);
fs.writeFileSync(lockfile, savedLock);
const agentsFile = path.join(tmp, '.agentdeps/runtime/ios/AGENTS.md');
const originalAgents = fs.readFileSync(agentsFile, 'utf8');
fs.appendFileSync(agentsFile, '\nTAMPERED\n');
const tamperDoctor = fail(['doctor', '--profile', 'ios']);
if (!tamperDoctor.includes('generated file hash mismatch')) throw new Error('doctor did not detect runtime tampering');
fail(['run', '--profile', 'ios', '--', process.execPath, '-e', 'process.exit(0)']);
fs.writeFileSync(agentsFile, originalAgents);
const evilSkill = path.join(tmp, '.agentdeps/runtime/ios/skills/evil/SKILL.md');
fs.mkdirSync(path.dirname(evilSkill), { recursive: true });
fs.writeFileSync(evilSkill, 'evil');
const extraDoctor = fail(['doctor', '--profile', 'ios']);
if (!extraDoctor.includes('generated extra file not in lock')) throw new Error('doctor did not detect extra runtime file');
fail(['run', '--profile', 'ios', '--', process.execPath, '-e', 'process.exit(0)']);
fs.rmSync(path.dirname(evilSkill), { recursive: true, force: true });
const countTamperedLock = savedLock.replace(/count = \d+/, 'count = 999');
fs.writeFileSync(lockfile, countTamperedLock);
const countDoctor = fail(['doctor', '--profile', 'ios']);
if (!countDoctor.includes('lockfile generated count mismatch')) throw new Error('doctor did not detect generated count mismatch');
fail(['run', '--profile', 'ios', '--', process.execPath, '-e', 'process.exit(0)']);
fs.writeFileSync(lockfile, savedLock);
run(['run', '--profile', 'ios', '--', process.execPath, '-e', 'if(!process.env.CODEX_HOME || !process.env.AGENTDEPS_AGENTS_PATH) process.exit(1); console.log(process.env.AGENTDEPS_PROFILE)']);

const expected = [
  'agentdeps.toml',
  '.agentdeps/agentdeps.lock.toml',
  '.agentdeps/session.toml',
  '.agentdeps/runtime/light/AGENTS.generated.md',
  '.agentdeps/runtime/ios/AGENTS.generated.md',
  '.agentdeps/runtime/ios/AGENTS.md',
  '.agentdeps/runtime/ios/config.toml',
  '.agentdeps/runtime/ios/metadata.json',
];
for (const file of expected) {
  if (!fs.existsSync(path.join(tmp, file))) throw new Error(`missing ${file}`);
}
const sessionText = fs.readFileSync(path.join(tmp, '.agentdeps/session.toml'), 'utf8');
if (!sessionText.includes('[session.toggles]')) throw new Error('session schema is not nested under [session.toggles]');
if (!savedLock.includes('[[generated.files]]')) throw new Error('lockfile does not include generated file hashes');
if (!doctor.includes('Global config changed: no')) throw new Error('doctor did not preserve global config claim');
if (!doctor.includes('Restart required: yes')) throw new Error('session hard capability restart was not reported');

const conflict = fs.mkdtempSync(path.join(os.tmpdir(), 'agentdeps-conflict-'));
run(['init', '--name', 'conflict'], { cwd: conflict });
for (const name of ['conflict-a', 'conflict-b']) {
  const dir = path.join(conflict, name, 'skills/same');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(conflict, name, 'module.toml'), `[module]\nname = "${name}"\nversion = "0.1.0"\ndescription = "conflict"\ncapability_classes = ["new-skills"]\nskills = ["same"]\nagents = []\nmcp = []\n`);
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: same\n---\n${name}\n`);
}
fs.appendFileSync(path.join(conflict, 'agentdeps.toml'), '\n[modules.conflict-a]\nsource = "file:./conflict-a"\nversion = "0.1.0"\n\n[modules.conflict-b]\nsource = "file:./conflict-b"\nversion = "0.1.0"\n');
run(['profile', 'enable', 'light', 'conflict-a'], { cwd: conflict });
run(['profile', 'enable', 'light', 'conflict-b'], { cwd: conflict });
const conflictOutput = fail(['install', '--profile', 'light'], { cwd: conflict });
if (!conflictOutput.includes('capability name conflicts detected')) throw new Error('duplicate skill conflict was not reported');

console.log(`smoke OK ${tmp}`);
