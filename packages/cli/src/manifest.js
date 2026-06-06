import path from 'node:path';
import { exists, readText, writeText, packageRoot, repoRoot } from './fs-utils.js';
import { assertKnownProfile, resolveProjectPath, validateProfileName } from './safety.js';
import { parseToml, stringifyToml } from './simple-toml.js';

export const MANIFEST_FILE = 'agentdeps.toml';
export const DEFAULT_AGENTDEPS_DIR = '.agentdeps';

export function loadManifest(root = repoRoot()) {
  const file = path.join(root, MANIFEST_FILE);
  if (!exists(file)) throw new Error(`missing ${MANIFEST_FILE}; run mad init first`);
  const manifest = parseToml(readText(file));
  validateManifest(manifest);
  return { file, manifest };
}

export function loadManifestIfPresent(root = repoRoot()) {
  const file = path.join(root, MANIFEST_FILE);
  if (!exists(file)) return null;
  const manifest = parseToml(readText(file));
  validateManifest(manifest);
  return { file, manifest };
}

export function writeManifest(file, manifest) {
  writeText(file, stringifyToml(manifest));
}

export function defaultManifest(name = path.basename(repoRoot())) {
  return {
    project: { name, default_profile: 'light' },
    profiles: {
      light: { description: 'Minimal repo-aware Codex environment.', modules: ['core', 'repo-basic'] },
      ios: { description: 'iOS modular architecture environment inspired by Tuist.', extends: 'light', modules: ['ios-swift', 'tuist', 'xcode-debugging'] },
      release: { description: 'iOS release and App Store operations.', extends: 'ios', modules: ['app-release', 'localization'] }
    },
    registry: { local: './.agentdeps/modules' },
    modules: builtinModuleRefs(),
    runtime: { materialization: 'copy', output_dir: '.agentdeps/runtime', lockfile: '.agentdeps/agentdeps.lock.toml' },
    policy: { auto_run_module_scripts: false, fail_on_name_conflict: true, require_lockfile_for_run: true },
    session: { allow_session_toggles: true, session_state: '.agentdeps/session.toml', restart_required_for: ['mcp', 'new-skills', 'new-agents'] }
  };
}

function builtinModuleRefs() {
  return Object.fromEntries(['core', 'repo-basic', 'ios-swift', 'tuist', 'xcode-debugging', 'app-release', 'localization'].map((name) => [name, { source: `builtin:${name}`, version: '0.1.0' }]));
}

export function selectedProfile(manifest, profile) {
  return validateProfileName(profile || manifest.project?.default_profile || 'light');
}

export function runtimeBaseDir(manifest, root = repoRoot()) {
  return resolveProjectPath(root, manifest.runtime?.output_dir || '.agentdeps/runtime', 'runtime.output_dir', { baseDir: '.agentdeps/runtime' });
}

export function runtimeDir(manifest, profile, root = repoRoot()) {
  assertKnownProfile(manifest, profile);
  return path.resolve(runtimeBaseDir(manifest, root), validateProfileName(profile));
}

export function lockfilePath(manifest, root = repoRoot()) {
  return resolveProjectPath(root, manifest.runtime?.lockfile || '.agentdeps/agentdeps.lock.toml', 'runtime.lockfile', { baseDir: '.agentdeps' });
}

export function sessionPath(manifest, root = repoRoot()) {
  return resolveProjectPath(root, manifest.session?.session_state || '.agentdeps/session.toml', 'session.session_state', { baseDir: '.agentdeps' });
}

export function expandProfile(manifest, profile) {
  const seen = new Set();
  const modules = [];
  function visit(name) {
    assertKnownProfile(manifest, name);
    if (seen.has(name)) return;
    const spec = manifest.profiles?.[name];
    if (!spec) throw new Error(`unknown profile: ${name}`);
    seen.add(name);
    if (spec.extends) visit(spec.extends);
    for (const moduleName of spec.modules || []) {
      if (!modules.includes(moduleName)) modules.push(moduleName);
    }
  }
  visit(profile);
  return modules;
}

export function resolveModuleDir(manifest, moduleName, root = repoRoot()) {
  const ref = manifest.modules?.[moduleName];
  if (!ref) throw new Error(`module ${moduleName} is not declared in [modules]`);
  const source = ref.source || `builtin:${moduleName}`;
  if (source.startsWith('builtin:')) return path.join(packageRoot(), 'modules', source.slice('builtin:'.length));
  if (source.startsWith('file:')) return path.resolve(root, source.slice('file:'.length));
  throw new Error(`unsupported module source for ${moduleName}: ${source}`);
}

export function validateManifest(manifest) {
  if (!manifest.project?.name) throw new Error('manifest requires [project].name');
  if (!manifest.profiles || typeof manifest.profiles !== 'object') throw new Error('manifest requires [profiles.*]');
}
