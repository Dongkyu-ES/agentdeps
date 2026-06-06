export function parseToml(source) {
  const root = {};
  let current = root;
  const lines = source.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      current = root;
      for (const part of section[1].split('.')) {
        const key = part.trim();
        if (!key) throw new Error(`invalid TOML section: ${rawLine}`);
        if (!isObject(current[key])) current[key] = {};
        current = current[key];
      }
      continue;
    }

    const eq = line.indexOf('=');
    if (eq === -1) throw new Error(`invalid TOML assignment: ${rawLine}`);
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) throw new Error(`invalid TOML key: ${rawLine}`);
    current[key] = parseValue(value);
  }

  return root;
}

export function stringifyToml(value) {
  const lines = [];
  writeTable(lines, [], value, true);
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function writeTable(lines, path, table, isRoot = false) {
  const entries = Object.entries(table || {});
  const scalars = entries.filter(([, value]) => !isPlainObject(value));
  const children = entries.filter(([, value]) => isPlainObject(value));

  if (!isRoot) lines.push(`[${path.join('.')}]`);
  for (const [key, value] of scalars) lines.push(`${key} = ${formatValue(value)}`);
  if (scalars.length && children.length) lines.push('');

  children.forEach(([key, child], index) => {
    if (!isRoot || scalars.length || index > 0) lines.push('');
    writeTable(lines, [...path, key], child);
  });
}

function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('[') && value.endsWith(']')) return parseArray(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return unquote(value);
  }
  return value;
}

function parseArray(value) {
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];
  const values = [];
  let token = '';
  let quote = null;
  let escaped = false;

  for (const char of inner) {
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quote === '"') {
      token += char;
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      token += char;
      continue;
    }
    if (char === quote) {
      quote = null;
      token += char;
      continue;
    }
    if (char === ',' && !quote) {
      values.push(parseValue(token.trim()));
      token = '';
      continue;
    }
    token += char;
  }
  if (token.trim()) values.push(parseValue(token.trim()));
  return values;
}

function stripComment(line) {
  let quote = null;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && quote === '"') {
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      continue;
    }
    if (char === quote) {
      quote = null;
      continue;
    }
    if (char === '#' && !quote) return line.slice(0, i);
  }
  return line;
}

function formatValue(value) {
  if (Array.isArray(value)) return `[${value.map(formatValue).join(', ')}]`;
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value == null) return '""';
  return JSON.stringify(String(value));
}

function unquote(value) {
  if (value.startsWith('"')) return JSON.parse(value);
  return value.slice(1, -1);
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]';
}
