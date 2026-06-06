import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { defaultManifest, expandProfile, loadManifest, loadManifestIfPresent, lockfilePath, MANIFEST_FILE, runtimeDir, selectedProfile, writeManifest } from './manifest.js';
import { assertKnownProfile } from './safety.js';
import { ensureDir, exists, relativeToCwd, repoRoot } from './fs-utils.js';
import { installRuntime } from './materializer.js';
import { assertLockClean, verifyLock } from './lock.js';
import { loadModule, loadModules } from './modules.js';
import { applySession, sessionSummary } from './session.js';

export function cmdInit(args) {
  const root = repoRoot();
  const force = hasFlag(args, '--force');
  const name = option(args, '--name') || path.basename(root);
  const file = path.join(root, MANIFEST_FILE);
  if (exists(file) && !force) throw new Error(`${MANIFEST_FILE} already exists; use --force to overwrite`);
  writeManifest(file, defaultManifest(name));
  ensureDir(path.join(root, '.agentdeps'));
  console.log(`created ${relativeToCwd(file)}`);
  console.log('next: mad install --profile light && mad doctor --profile light');
}

export function cmdInstall(args) {
  const root = repoRoot();
  const { manifest } = loadManifest(root);
  const profile = assertKnownProfile(manifest, option(args, '--profile') || selectedProfile(manifest));
  const result = installRuntime(manifest, profile, root);
  console.log(`Profile: ${profile}`);
  console.log(`Runtime: ${relativeToCwd(result.output)}`);
  console.log(`Lockfile: ${relativeToCwd(result.lockfile)}`);
  console.log(`Modules: ${result.modules.map((module) => module.name).join(', ')}`);
  console.log('Global config changed: no');
}

export function cmdDoctor(args) {
  const root = repoRoot();
  const loaded = loadManifestIfPresent(root);
  if (!loaded) throw new Error(`${MANIFEST_FILE} not found; run mad init first`);
  const { manifest } = loaded;
  const profile = assertKnownProfile(manifest, option(args, '--profile') || selectedProfile(manifest));
  const runtime = runtimeDir(manifest, profile, root);
  const lockfile = lockfilePath(manifest, root);
  const sessionMode = hasFlag(args, '--session');
  const modules = expandProfile(manifest, profile);
  const missing = modules.filter((moduleName) => !exists(path.join(root, 'modules', moduleName)) && !manifest.modules?.[moduleName]?.source?.startsWith('file:') && !manifest.modules?.[moduleName]?.source?.startsWith('builtin:'));
  const warnings = [];
  if (!exists(runtime)) warnings.push(`runtime missing: ${relativeToCwd(runtime)}; run mad install --profile ${profile}`);
  warnings.push(...verifyLock(manifest, profile, runtime, root, modules));

  const session = sessionSummary(manifest, root);
  if (sessionMode && !session.session) warnings.push(`session state missing: ${relativeToCwd(session.file)}; run mad agent apply --session`);

  const report = {
    profile,
    runtime: relativeToCwd(runtime),
    lockfile: relativeToCwd(lockfile),
    modules,
    globalConfigChanged: false,
    warnings,
    missing,
    session: session.session || null
  };

  if (hasFlag(args, '--json')) {
    console.log(JSON.stringify(report, null, 2));
    return warnings.length || missing.length ? 1 : 0;
  }

  console.log(`Profile: ${profile}`);
  console.log(`Runtime: ${report.runtime}${exists(runtime) ? ' (exists)' : ' (missing)'}`);
  console.log(`Lockfile: ${report.lockfile}${exists(lockfile) ? ' (exists)' : ' (missing)'}`);
  console.log(`Modules: ${modules.join(', ')}`);
  console.log('Global config changed: no');
  if (sessionMode) printSessionState(session);
  if (warnings.length) console.log(`Warnings:\n- ${warnings.join('\n- ')}`);
  if (missing.length) console.log(`Missing modules:\n- ${missing.join('\n- ')}`);
  console.log(warnings.length || missing.length ? 'Doctor: warnings' : 'Doctor: pass');
  return warnings.length || missing.length ? 1 : 0;
}

export function cmdRun(args) {
  const root = repoRoot();
  const { manifest } = loadManifest(root);
  const profile = assertKnownProfile(manifest, option(args, '--profile') || selectedProfile(manifest));
  const separator = args.indexOf('--');
  const command = separator === -1 ? args.filter((arg) => !arg.startsWith('--') && arg !== option(args, '--profile')) : args.slice(separator + 1);
  if (!command.length) throw new Error('usage: mad run --profile <profile> -- <command>');
  const runtime = runtimeDir(manifest, profile, root);
  if (!exists(runtime)) throw new Error(`runtime missing: ${relativeToCwd(runtime)}; run mad install --profile ${profile}`);
  assertLockClean(manifest, profile, runtime, root, expandProfile(manifest, profile));
  const agentsPath = path.join(runtime, 'AGENTS.md');
  const env = { ...process.env, AGENTDEPS_PROFILE: profile, AGENTDEPS_RUNTIME: runtime, AGENTDEPS_AGENTS_PATH: agentsPath, CODEX_HOME: runtime };
  console.log(`Profile: ${profile}`);
  console.log(`Runtime: ${relativeToCwd(runtime)}`);
  console.log(`Agent instructions: ${relativeToCwd(agentsPath)}`);
  console.log(`Command: ${command.join(' ')}`);
  const result = spawnSync(command[0], command.slice(1), { stdio: 'inherit', env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 0;
}

export function cmdAgent(args) {
  const sub = args[0] || 'status';
  const rest = args.slice(1);
  if (sub === 'status') return agentStatus(rest);
  if (sub === 'capabilities') return agentCapabilities(rest);
  if (sub === 'explain') return agentExplain(rest);
  if (sub === 'apply') return agentApply(rest);
  if (sub === 'bootstrap') return cmdBootstrap(rest);
  if (sub === 'restart-command') return agentRestartCommand(rest);
  throw new Error(`unknown agent command: ${sub}`);
}

export function cmdAdd(args) {
  const modules = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--profile');
  if (!modules.length) throw new Error('usage: mad add <module...> [--profile <profile>]');
  const root = repoRoot();
  const loaded = loadManifest(root);
  const profile = option(args, '--profile') || selectedProfile(loaded.manifest);
  assertKnownProfile(loaded.manifest, profile);
  const spec = loaded.manifest.profiles?.[profile];
  ensureDeclaredModules(loaded.manifest, modules, root);
  spec.modules ||= [];
  for (const moduleName of modules) {
    if (!spec.modules.includes(moduleName)) spec.modules.push(moduleName);
  }
  writeManifest(loaded.file, loaded.manifest);
  console.log(`added ${modules.join(', ')} to profile ${profile}`);
}

export function cmdRemove(args) {
  const modules = args.filter((arg, index) => !arg.startsWith('--') && args[index - 1] !== '--profile');
  if (!modules.length) throw new Error('usage: mad remove <module...> [--profile <profile>]');
  const root = repoRoot();
  const loaded = loadManifest(root);
  const profile = option(args, '--profile') || selectedProfile(loaded.manifest);
  assertKnownProfile(loaded.manifest, profile);
  const spec = loaded.manifest.profiles?.[profile];
  spec.modules ||= [];
  spec.modules = spec.modules.filter((item) => !modules.includes(item));
  writeManifest(loaded.file, loaded.manifest);
  console.log(`removed ${modules.join(', ')} from profile ${profile}`);
}

export function cmdProfile(args) {
  const action = args[0];
  const profile = args[1];
  const moduleName = args[2];
  if (!['enable', 'disable'].includes(action) || !profile || !moduleName) throw new Error('usage: mad profile enable|disable <profile> <module>');
  const root = repoRoot();
  const loaded = loadManifest(root);
  assertKnownProfile(loaded.manifest, profile);
  const spec = loaded.manifest.profiles?.[profile];
  ensureDeclaredModules(loaded.manifest, [moduleName], root);
  spec.modules ||= [];
  if (action === 'enable' && !spec.modules.includes(moduleName)) spec.modules.push(moduleName);
  if (action === 'disable') spec.modules = spec.modules.filter((item) => item !== moduleName);
  writeManifest(loaded.file, loaded.manifest);
  console.log(`${action}d ${moduleName} ${action === 'enable' ? 'in' : 'from'} profile ${profile}`);
}

export function cmdClean(args) {
  const root = repoRoot();
  const { manifest } = loadManifest(root);
  const profile = assertKnownProfile(manifest, option(args, '--profile') || selectedProfile(manifest));
  const runtime = runtimeDir(manifest, profile, root);
  fs.rmSync(runtime, { recursive: true, force: true });
  console.log(`removed ${relativeToCwd(runtime)}`);
}

function agentStatus(args) {
  const root = repoRoot();
  const loaded = loadManifestIfPresent(root);
  if (!loaded) throw new Error(`${MANIFEST_FILE} not found; run mad init first`);
  const { manifest } = loaded;
  const profile = assertKnownProfile(manifest, option(args, '--profile') || selectedProfile(manifest));
  const modules = expandProfile(manifest, profile);
  const runtime = runtimeDir(manifest, profile, root);
  const lockfile = lockfilePath(manifest, root);
  const session = sessionSummary(manifest, root);
  const report = { profile, modules, runtime: relativeToCwd(runtime), runtimeExists: exists(runtime), lockfile: relativeToCwd(lockfile), lockfileExists: exists(lockfile), sessionFile: relativeToCwd(session.file), session: session.session, globalConfigChanged: false };
  if (hasFlag(args, '--json')) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Profile: ${profile}`);
    console.log(`Runtime: ${report.runtime}${report.runtimeExists ? ' (exists)' : ' (missing)'}`);
    console.log(`Lockfile: ${report.lockfile}${report.lockfileExists ? ' (exists)' : ' (missing)'}`);
    console.log(`Modules: ${modules.join(', ')}`);
    console.log(`Session: ${session.session ? relativeToCwd(session.file) : 'none'}`);
    console.log('Global config changed: no');
  }
}

function agentCapabilities(args) {
  const root = repoRoot();
  const { manifest } = loadManifest(root);
  const profile = assertKnownProfile(manifest, option(args, '--profile') || selectedProfile(manifest));
  const modules = loadModules(manifest, expandProfile(manifest, profile), root);
  for (const module of modules) {
    console.log(`${module.name}\t${module.capabilityClasses.join(',') || 'soft-instruction'}\t${module.description}`);
  }
}

function agentExplain(args) {
  const moduleName = args.find((arg) => !arg.startsWith('--'));
  if (!moduleName) throw new Error('usage: mad agent explain <module>');
  const root = repoRoot();
  const { manifest } = loadManifest(root);
  const module = loadModule(manifest, moduleName, root);
  console.log(`Module: ${module.name}`);
  console.log(`Version: ${module.version}`);
  console.log(`Description: ${module.description}`);
  console.log(`Capability classes: ${module.capabilityClasses.join(', ') || 'soft-instruction'}`);
  console.log(`Skills: ${module.skills.join(', ') || 'none'}`);
  console.log(`Agents: ${module.agents.join(', ') || 'none'}`);
  console.log(`MCP: ${module.mcp.join(', ') || 'none'}`);
}

function agentApply(args) {
  if (!hasFlag(args, '--session')) throw new Error('MVP supports agent apply only with --session');
  const root = repoRoot();
  const { manifest } = loadManifest(root);
  const profile = assertKnownProfile(manifest, option(args, '--profile') || selectedProfile(manifest));
  const enable = multiOption(args, '--enable');
  const disable = multiOption(args, '--disable');
  const result = applySession(manifest, root, { profile, enable, disable });
  console.log(`Session: ${relativeToCwd(result.file)}`);
  console.log(`Session intent recorded: ${[...enable, ...disable].filter(Boolean).join(', ') || 'current profile'}`);
  console.log('Generated for next run: no runtime regeneration was performed by session apply; run mad install for durable runtime changes');
  console.log(`Restart required: ${result.reasons.length ? 'yes' : 'no'}`);
  if (result.reasons.length) console.log(`Reasons:\n- ${result.reasons.join('\n- ')}`);
  console.log('Blocked: none');
}

function agentRestartCommand(args) {
  const root = repoRoot();
  const { manifest } = loadManifest(root);
  const profile = assertKnownProfile(manifest, option(args, '--profile') || selectedProfile(manifest));
  console.log(`mad run --profile ${profile} -- codex`);
  console.log(`# or: mad run --profile ${profile} -- omx`);
}

function printSessionState(session) {
  if (!session.session) {
    console.log('Session intent recorded: none');
    console.log('Generated for next run: no session changes');
    console.log('Restart required: unknown (no session state)');
    console.log('Blocked: none');
    return;
  }
  const toggles = session.session.session?.toggles || session.session.toggles || {};
  const restart = session.session.session?.restart_required || session.session.restart_required || {};
  console.log(`Session: ${relativeToCwd(session.file)}`);
  console.log(`Session intent recorded: enabled ${(toggles?.enabled || []).join(', ') || 'none'}; disabled ${(toggles?.disabled || []).join(', ') || 'none'}`);
  console.log('Generated for next run: run mad install to materialize durable runtime changes');
  console.log(`Restart required: ${restart.required ? 'yes' : 'no'}`);
  if (restart.reasons?.length) console.log(`Restart reasons:\n- ${restart.reasons.join('\n- ')}`);
  console.log('Blocked: none');
}

export function cmdBootstrap(args) {
  const root = repoRoot();
  const { manifest } = loadManifest(root);
  const profile = assertKnownProfile(manifest, option(args, '--profile') || selectedProfile(manifest));
  const install = installRuntime(manifest, profile, root);
  console.log(`Bootstrap runtime: ${relativeToCwd(install.output)}`);
  return cmdDoctor(['--profile', profile]);
}

function ensureDeclaredModules(manifest, moduleNames, root) {
  for (const moduleName of moduleNames) {
    if (!manifest.modules?.[moduleName]) throw new Error(`module ${moduleName} is not declared in [modules]`);
    loadModule(manifest, moduleName, root);
  }
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function option(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

function multiOption(args, flag) {
  const values = [];
  args.forEach((arg, index) => {
    if (arg === flag && args[index + 1]) values.push(...args[index + 1].split(',').map((item) => item.trim()).filter(Boolean));
  });
  return values;
}
