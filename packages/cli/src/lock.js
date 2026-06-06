import fs from 'node:fs';
import path from 'node:path';
import { exists, hashFile, listFiles, relativeToCwd } from './fs-utils.js';
import { lockfilePath } from './manifest.js';
import { loadModules } from './modules.js';

export function parseLock(text) {
  return {
    profile: readScalar(text, 'profile'),
    runtime: readScalar(text, 'runtime'),
    generatedCount: readNumberInSection(text, 'generated', 'count'),
    modules: readBlocks(text, 'modules').map((block) => ({
      name: readScalar(block, 'name'),
      version: readScalar(block, 'version'),
      hash: readScalar(block, 'hash')
    })),
    generatedFiles: readBlocks(text, 'generated.files').map((block) => ({
      path: readScalar(block, 'path'),
      sha256: readScalar(block, 'sha256')
    }))
  };
}

export function verifyLock(manifest, profile, runtime, root, moduleNames) {
  const problems = [];
  const lockfile = lockfilePath(manifest, root);
  if (!exists(lockfile)) return [`lockfile missing: ${relativeToCwd(lockfile)}; run mad install --profile ${profile}`];

  let lock;
  try {
    lock = parseLock(fs.readFileSync(lockfile, 'utf8'));
  } catch (error) {
    return [`lockfile unreadable: ${error.message}`];
  }

  const expectedRuntime = relativeToCwd(runtime);
  if (lock.profile !== profile) problems.push(`lockfile profile mismatch: expected ${profile}, found ${lock.profile || '<missing>'}`);
  if (lock.runtime !== expectedRuntime) problems.push(`lockfile runtime mismatch: expected ${expectedRuntime}, found ${lock.runtime || '<missing>'}`);

  const actualModules = loadModules(manifest, moduleNames, root);
  const lockedModules = new Map(lock.modules.map((module) => [module.name, module]));
  for (const module of actualModules) {
    const locked = lockedModules.get(module.name);
    if (!locked) {
      problems.push(`lockfile missing module: ${module.name}`);
      continue;
    }
    if (locked.hash !== module.hash) problems.push(`module hash mismatch for ${module.name}: expected ${module.hash}, found ${locked.hash}`);
  }
  for (const lockedName of lockedModules.keys()) {
    if (!actualModules.some((module) => module.name === lockedName)) problems.push(`lockfile has extra module: ${lockedName}`);
  }

  for (const required of ['AGENTS.md', 'AGENTS.generated.md', 'config.toml', 'metadata.json']) {
    const file = path.join(runtime, required);
    if (!exists(file)) problems.push(`runtime required file missing: ${path.join(relativeToCwd(runtime), required)}`);
  }

  if (!lock.generatedFiles.length) problems.push('lockfile missing generated file hashes');
  if (lock.generatedCount == null) {
    problems.push('lockfile missing generated count');
  } else if (lock.generatedCount !== lock.generatedFiles.length) {
    problems.push(`lockfile generated count mismatch: count=${lock.generatedCount}, files=${lock.generatedFiles.length}`);
  }

  const lockedFileSet = new Set(lock.generatedFiles.map((file) => file.path).filter(Boolean));
  const actualRuntimeFiles = exists(runtime) ? listFiles(runtime).map((file) => path.relative(runtime, file)).sort() : [];
  for (const actual of actualRuntimeFiles) {
    if (!lockedFileSet.has(actual)) problems.push(`generated extra file not in lock: ${path.join(relativeToCwd(runtime), actual)}`);
  }

  for (const file of lock.generatedFiles) {
    const full = path.join(runtime, file.path || '');
    if (!file.path || !file.sha256) {
      problems.push(`lockfile has malformed generated file entry: ${JSON.stringify(file)}`);
      continue;
    }
    if (!exists(full)) {
      problems.push(`generated file missing: ${path.join(relativeToCwd(runtime), file.path)}`);
      continue;
    }
    const actual = hashFile(full);
    if (actual !== file.sha256) problems.push(`generated file hash mismatch: ${path.join(relativeToCwd(runtime), file.path)}`);
  }

  return problems;
}

export function assertLockClean(manifest, profile, runtime, root, moduleNames) {
  const problems = verifyLock(manifest, profile, runtime, root, moduleNames);
  if (problems.length) throw new Error(`lock verification failed:\n- ${problems.join('\n- ')}`);
}

function readNumberInSection(text, section, key) {
  const lines = text.split(/\r?\n/);
  const header = `[${section}]`;
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('[')) break;
    body.push(lines[i]);
  }
  const match = body.join('\n').match(new RegExp(`^${escapeRegExp(key)}\\s*=\\s*(\\d+)`, 'm'));
  return match ? Number(match[1]) : null;
}

function readScalar(text, key) {
  const match = text.match(new RegExp(`^${escapeRegExp(key)}\\s*=\\s*"([^"]*)"`, 'm'));
  return match ? match[1] : null;
}

function readBlocks(text, table) {
  const escaped = table.replace(/\./g, '\\.');
  const marker = new RegExp(`^\\[\\[${escaped}\\]\\]\\s*$`, 'm');
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (marker.test(line)) {
      if (current) blocks.push(current.join('\n'));
      current = [];
      continue;
    }
    if (current && /^\[/.test(line)) {
      blocks.push(current.join('\n'));
      current = null;
      continue;
    }
    if (current) current.push(line);
  }
  if (current) blocks.push(current.join('\n'));
  return blocks;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
