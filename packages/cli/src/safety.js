import path from 'node:path';

export function validateProfileName(profile) {
  if (!profile || typeof profile !== 'string') throw new Error('profile is required');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(profile)) {
    throw new Error(`unsafe profile name: ${profile}`);
  }
  return profile;
}

export function assertKnownProfile(manifest, profile) {
  validateProfileName(profile);
  if (!manifest.profiles?.[profile]) throw new Error(`unknown profile: ${profile}`);
  return profile;
}

export function resolveProjectPath(root, configuredPath, label, { baseDir = null } = {}) {
  if (!configuredPath || typeof configuredPath !== 'string') throw new Error(`${label} path is required`);
  if (path.isAbsolute(configuredPath)) throw new Error(`${label} must be project-relative: ${configuredPath}`);
  const resolved = path.resolve(root, configuredPath);
  const parent = baseDir ? path.resolve(root, baseDir) : path.resolve(root);
  if (!isInside(resolved, parent)) {
    throw new Error(`${label} must stay inside ${path.relative(root, parent) || '.'}: ${configuredPath}`);
  }
  return resolved;
}

export function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}
