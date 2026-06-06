import { exists, readText, timestamp, writeText } from './fs-utils.js';
import { parseToml, stringifyToml } from './simple-toml.js';
import { selectedProfile, sessionPath } from './manifest.js';
import { assertKnownProfile } from './safety.js';
import { loadModule, moduleHasHardCapability } from './modules.js';

export function loadSession(manifest, root) {
  const file = sessionPath(manifest, root);
  if (!exists(file)) return { file, session: null };
  return { file, session: parseToml(readText(file)) };
}

export function applySession(manifest, root, { profile, enable = [], disable = [] }) {
  const activeProfile = assertKnownProfile(manifest, profile || selectedProfile(manifest));
  const { file, session } = loadSession(manifest, root);
  const current = normalizeSession(session, activeProfile);
  current.session.active_profile = activeProfile;
  current.session.mode = 'advisory';
  current.session.updated_by = 'agentdeps-cli';
  current.session.updated_at = timestamp();
  current.session.toggles.enabled = mergeToggle(current.session.toggles.enabled || [], enable, disable);
  current.session.toggles.disabled = mergeToggle(current.session.toggles.disabled || [], disable, enable);

  const reasons = restartReasons(manifest, root, [...enable, ...disable]);
  current.session.restart_required.required = reasons.length > 0;
  current.session.restart_required.reasons = reasons;

  writeText(file, stringifyToml(current));
  return { file, session: current, reasons };
}

export function sessionSummary(manifest, root) {
  const { file, session } = loadSession(manifest, root);
  return { file, session };
}

function normalizeSession(value, activeProfile) {
  const current = value || { session: {} };
  current.session ||= {};
  // Backward compatibility with early v0 top-level session files.
  current.session.toggles ||= current.toggles || { enabled: [], disabled: [] };
  current.session.restart_required ||= current.restart_required || { required: false, reasons: [] };
  delete current.toggles;
  delete current.restart_required;
  current.session.active_profile ||= activeProfile;
  current.session.mode ||= 'advisory';
  return current;
}

function mergeToggle(current, add, remove) {
  const values = new Set(current || []);
  for (const item of remove || []) values.delete(item);
  for (const item of add || []) values.add(item);
  return [...values].sort();
}

function restartReasons(manifest, root, moduleNames) {
  const reasons = [];
  for (const name of new Set(moduleNames.filter(Boolean))) {
    try {
      const module = loadModule(manifest, name, root);
      if (moduleHasHardCapability(module)) {
        reasons.push(`${name}: skills/agents/MCP discovery changes should be treated as next-session capabilities`);
      }
    } catch (error) {
      throw new Error(`cannot apply unresolved module ${name}: ${error.message}`);
    }
  }
  return [...new Set(reasons)];
}
