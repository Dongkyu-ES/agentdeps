import path from 'node:path';
import { exists, readText, listFiles, hashFile, sha256 } from './fs-utils.js';
import { parseToml } from './simple-toml.js';
import { resolveModuleDir } from './manifest.js';

export function loadModule(manifest, moduleName, root) {
  const dir = resolveModuleDir(manifest, moduleName, root);
  const file = path.join(dir, 'module.toml');
  if (!exists(file)) throw new Error(`module ${moduleName} is missing module.toml at ${dir}`);
  const parsed = parseToml(readText(file));
  const module = parsed.module || {};
  if ((module.name || moduleName) !== moduleName) throw new Error(`module name mismatch: expected ${moduleName}, got ${module.name}`);
  return {
    name: moduleName,
    version: module.version || manifest.modules?.[moduleName]?.version || '0.0.0',
    description: module.description || '',
    capabilityClasses: module.capability_classes || [],
    skills: module.skills || [],
    agents: module.agents || [],
    mcp: module.mcp || [],
    dir,
    hash: hashModuleDir(dir)
  };
}

export function loadModules(manifest, moduleNames, root) {
  return moduleNames.map((name) => loadModule(manifest, name, root));
}

export function readFragment(module) {
  const file = path.join(module.dir, 'AGENTS.fragment.md');
  return exists(file) ? readText(file).trim() : '';
}

export function moduleHasHardCapability(module) {
  return module.capabilityClasses.some((item) => ['mcp', 'new-skills', 'new-agents'].includes(item)) || module.skills.length || module.agents.length || module.mcp.length;
}

function hashModuleDir(dir) {
  const hashes = listFiles(dir)
    .sort()
    .map((file) => `${path.relative(dir, file)}:${hashFile(file)}`)
    .join('\n');
  return hashString(hashes);
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  return sha256(value).slice(0, 16);
}

