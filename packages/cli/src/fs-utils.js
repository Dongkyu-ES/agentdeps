import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function repoRoot() {
  return process.cwd();
}

export function packageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

export function writeText(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
}

export function exists(file) {
  return fs.existsSync(file);
}

export function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function copyDir(source, target) {
  if (!exists(source)) return;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dst = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dst);
    } else if (entry.isFile()) {
      ensureDir(path.dirname(dst));
      fs.copyFileSync(src, dst);
    }
  }
}

export function listFiles(dir) {
  if (!exists(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function hashFile(file) {
  return sha256(fs.readFileSync(file));
}

export function timestamp() {
  return new Date().toISOString();
}

export function relativeToCwd(file) {
  return path.relative(process.cwd(), file) || '.';
}
