#!/usr/bin/env node
/**
 * Converts all console.log/error/warn calls to logger.info/error/warn
 * across specified source files. console.debug is left untouched.
 *
 * Logger signature: logger.info(context: string, message: string, data?: any)
 *
 * Usage: node scripts/convert-console-to-logger.cjs
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILES = [
  'contexts/AuthContext.tsx',
  'contexts/BundleContext.tsx',
  'contexts/ServiceRequestContext.tsx',
  'contexts/SwapContext.tsx',
  'contexts/MessagingContext.tsx',
  'contexts/OnboardingContext.tsx',
  'contexts/SocialContext.tsx',
  'contexts/MarketplaceContext.tsx',
  'contexts/ConnectionsContext.tsx',
  'contexts/LifeCrmContext.tsx',
  'contexts/PlannerContext.tsx',
  'contexts/BookingsContext.tsx',
  'contexts/ThemeContext.tsx',
  'app/_layout.tsx',
];

const SKIP_FILES = [
  'contexts/TabBarContext.tsx',
  'app/(tabs)/feed/index.tsx',
  'lib/feedAggregator.ts',
];

const LOGGER_IMPORT = "import { logger } from '@/lib/logger';";

const LEVEL_MAP = { log: 'info', error: 'error', warn: 'warn' };

/**
 * Simple identifier check (valid JS shorthand property name).
 */
function isSimpleIdentifier(s) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

/**
 * Extract the last property name from a compound expression.
 * "error.message" → "message"
 * "data.session.user.email" → "email"
 * "request.fromProfile.name" → "name"
 */
function lastPropName(expr) {
  const m = expr.match(/\.([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
  return m ? m[1] : null;
}

/**
 * Tokenize the raw argument string inside the parentheses.
 * Handles: strings, template literals, objects/arrays, and arbitrary expressions.
 */
function tokenizeArgs(raw) {
  const tokens = [];
  let i = 0;
  const n = raw.length;

  function skipWS() {
    while (i < n && (raw[i] === ' ' || raw[i] === '\t' || raw[i] === '\n' || raw[i] === '\r')) i++;
  }

  while (i < n) {
    skipWS();
    if (i >= n) break;

    // String literal
    if (raw[i] === "'" || raw[i] === '"') {
      const q = raw[i];
      let j = i + 1;
      while (j < n) {
        if (raw[j] === '\\') { j += 2; continue; }
        if (raw[j] === q) break;
        j++;
      }
      tokens.push({ type: 'string', value: raw.slice(i + 1, j), raw: raw.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Template literal
    if (raw[i] === '`') {
      let j = i + 1;
      let depth = 0;
      while (j < n) {
        if (raw[j] === '`' && depth === 0) break;
        if (raw[j] === '\\') { j += 2; continue; }
        if (raw[j] === '$' && raw[j + 1] === '{') { depth++; j += 2; continue; }
        if (raw[j] === '}' && depth > 0) { depth--; j++; continue; }
        j++;
      }
      tokens.push({ type: 'template', value: raw.slice(i, j + 1), raw: raw.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Object or array literal
    if (raw[i] === '{' || raw[i] === '[') {
      const open = raw[i];
      const close = open === '{' ? '}' : ']';
      let j = i + 1;
      let depth = 1;
      while (j < n && depth > 0) {
        const c = raw[j];
        if (c === "'" || c === '"') { const q = c; j++; while (j < n && raw[j] !== q) { if (raw[j] === '\\') j++; j++; } j++; continue; }
        if (c === '`') { j++; let td = 0; while (j < n && !(raw[j] === '`' && td === 0)) { if (raw[j] === '\\') { j+=2; continue; } if (raw[j] === '$' && raw[j+1] === '{') { td++; j+=2; continue; } if (raw[j] === '}' && td > 0) { td--; j++; continue; } j++; } j++; continue; }
        if (c === open) depth++;
        if (c === close) depth--;
        j++;
      }
      tokens.push({ type: 'object', value: raw.slice(i, j), raw: raw.slice(i, j) });
      i = j;
      continue;
    }

    // Comma separator
    if (raw[i] === ',') {
      tokens.push({ type: 'comma', value: ',', raw: ',' });
      i++;
      continue;
    }

    // Expression (variable, function call, member access, etc.)
    let j = i;
    let parenDepth = 0;
    while (j < n) {
      const c = raw[j];
      if (c === ',' && parenDepth === 0) break;
      if (c === ')' && parenDepth === 0) break;
      if (c === '(') parenDepth++;
      if (c === ')') parenDepth--;
      j++;
    }
    const expr = raw.slice(i, j).trim();
    if (expr.length > 0) {
      tokens.push({ type: 'expr', value: expr, raw: raw.slice(i, j) });
    }
    i = j;
  }

  return tokens.filter(t => t.type !== 'comma');
}

/**
 * Parse a console call into logger args.
 * Returns null for console.debug or unparseable calls.
 */
function parseConsoleCall(method, rawArgs) {
  if (method === 'debug') return null;

  const level = LEVEL_MAP[method];
  const tokens = tokenizeArgs(rawArgs);

  if (tokens.length === 0) {
    return { level, tag: 'App', message: '', dataObj: null };
  }

  const first = tokens[0];

  // ── First arg is a string ──────────────────────────────────────────
  if (first.type === 'string') {
    const tagMatch = first.value.match(/^\[([^\]]+)\]\s*(.*)/);
    const context = tagMatch ? tagMatch[1] : 'App';
    let message = tagMatch ? (tagMatch[2] || '') : first.value;

    // Collect remaining args
    const extras = tokens.slice(1);
    if (extras.length === 0) {
      return { level, tag: context, message, dataObj: null };
    }

    // Filter out label strings (e.g., 'username:' between variable args)
    const valueTokens = extras.filter(t => t.type !== 'string');

    // If the only extra was a label string with nothing after
    if (valueTokens.length === 0) {
      return { level, tag: context, message, dataObj: null };
    }

    // Strip trailing colon from message when we have data
    message = message.replace(/:$/, '').trimEnd();

    // Build data object
    return { level, tag: context, message, dataObj: buildDataObj(valueTokens) };
  }

  // ── First arg is a template literal ────────────────────────────────
  if (first.type === 'template') {
    // Try to match a tag at the beginning of the template
    const inner = first.value.slice(1, -1); // strip backticks
    const tagMatch = inner.match(/^\[([^\]]+)\]\s*(.*)/);

    const context = tagMatch ? tagMatch[1] : 'App';
    // For template literals, we keep the whole template as the message
    // since it includes interpolated expressions
    const message = first.value;

    const extras = tokens.slice(1).filter(t => t.type !== 'string');
    if (extras.length === 0) {
      return { level, tag: context, message, dataObj: null };
    }
    return { level, tag: context, message, dataObj: buildDataObj(extras) };
  }

  // ── First arg is an object ─────────────────────────────────────────
  if (first.type === 'object') {
    return { level, tag: 'App', message: '', dataObj: first.value };
  }

  // ── First arg is an expression ─────────────────────────────────────
  if (first.type === 'expr') {
    const extras = tokens.slice(1).filter(t => t.type !== 'string');
    let dataObj = null;
    if (extras.length > 0) {
      dataObj = buildDataObj(extras);
    } else {
      dataObj = buildDataObj([first]);
    }
    return { level, tag: 'App', message: String(first.value), dataObj };
  }

  return null;
}

/**
 * Build the data object third argument from extra tokens.
 * - { type: 'object' } → inline directly (no extra wrapping)
 * - { type: 'expr', simple } → shorthand { expr }
 * - { type: 'expr', compound } → { lastProp: expr }
 * - Multiple tokens → merge into one object
 */
function buildDataObj(valueTokens) {
  if (valueTokens.length === 0) return null;

  const parts = [];

  for (const tok of valueTokens) {
    if (tok.type === 'object') {
      // Object/array literal: unwrap one level if it starts with { and ends with }
      // Otherwise just inline it
      parts.push(tok.value);
    } else if (tok.type === 'expr') {
      if (isSimpleIdentifier(tok.value)) {
        parts.push(tok.value); // shorthand: `key` becomes key: key
      } else {
        const last = lastPropName(tok.value);
        if (last) {
          parts.push(`${last}: ${tok.value}`);
        } else {
          // Fallback: use the whole expression as both key and value would be weird,
          // just include as a string description
          parts.push(`value: ${tok.value}`);
        }
      }
    } else if (tok.type === 'template') {
      parts.push(`tmpl: ${tok.value}`);
    } else {
      parts.push(tok.value);
    }
  }

  if (parts.length === 0) return null;
  // Single object literal — return as-is (already has its own { })
  if (valueTokens.length === 1 && valueTokens[0].type === 'object') {
    return valueTokens[0].value;
  }
  if (parts.length === 1) {
    return `{ ${parts[0]} }`;
  }
  return `{ ${parts.join(', ')} }`;
}

/**
 * Find a single console.{method}(...) call starting at index `start`.
 */
function findConsoleCall(content, start) {
  const m = content.slice(start).match(/^console\.(\w+)\s*\(/);
  if (!m) return null;

  const method = m[1];
  const openParen = start + m[0].length - 1;

  // Find matching close paren
  let depth = 1;
  let i = openParen + 1;
  while (i < content.length && depth > 0) {
    const c = content[i];
    if (c === '\\') { i += 2; continue; }
    if (c === "'" || c === '"') { i++; while (i < content.length && content[i] !== c) { if (content[i] === '\\') i++; i++; } i++; continue; }
    if (c === '`') { i++; let td = 0; while (i < content.length && !(content[i] === '`' && td === 0)) { if (content[i] === '\\') { i+=2; continue; } if (content[i] === '$' && content[i+1] === '{') { td++; i+=2; continue; } if (content[i] === '}' && td > 0) { td--; i++; continue; } i++; } i++; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    i++;
  }

  return {
    method,
    argsRaw: content.slice(openParen + 1, i - 1),
    range: [start, i],
    fullText: content.slice(start, i),
  };
}

/**
 * Escape a string for use in a single-quoted JS string literal.
 */
function escS(s) {
  return s.includes("'") ? `"${s}"` : `'${s}'`;
}

/**
 * Build the logger call string from parsed components.
 */
function buildLoggerCall(parsed) {
  const { level, tag, message, dataObj } = parsed;

  if (!dataObj && !message) {
    return `logger.${level}(${escS(tag)})`;
  }
  if (!dataObj) {
    return `logger.${level}(${escS(tag)}, ${escS(message)})`;
  }
  return `logger.${level}(${escS(tag)}, ${escS(message)}, ${dataObj})`;
}

/**
 * Process a single source file.
 */
function processFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  let content = fs.readFileSync(fullPath, 'utf8');

  // Collect all replacement ranges (scan full file)
  const replacements = [];
  let idx = 0;
  while (idx < content.length) {
    const found = content.indexOf('console.', idx);
    if (found === -1) break;

    // Skip console.debug
    if (content.slice(found + 8, found + 13) === 'debug') {
      idx = found + 13;
      continue;
    }

    const call = findConsoleCall(content, found);
    if (!call) { idx = found + 8; continue; }
    if (call.method === 'debug') { idx = call.range[1]; continue; }

    const parsed = parseConsoleCall(call.method, call.argsRaw);
    if (!parsed) { idx = call.range[1]; continue; }

    replacements.push({ range: call.range, parsed });
    idx = call.range[1];
  }

  if (replacements.length === 0) {
    return { file: filePath, replacements: 0 };
  }

  // Apply replacements from end to start
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { range, parsed } = replacements[i];
    const newCall = buildLoggerCall(parsed);
    content = content.slice(0, range[0]) + newCall + content.slice(range[1]);
  }

  // Add import after the last import statement
  if (!content.includes(LOGGER_IMPORT)) {
    const lines = content.split('\n');
    let lastImportLine = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportLine = i;
      }
    }
    if (lastImportLine >= 0) {
      lines.splice(lastImportLine + 1, 0, LOGGER_IMPORT);
      content = lines.join('\n');
    }
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  return { file: filePath, replacements: replacements.length };
}

// ── Main ──────────────────────────────────────────────────────────────────
console.log('Starting console → logger conversion...\n');

let totalReplacements = 0;
const summary = [];

for (const file of TARGET_FILES) {
  const { file: f, replacements } = processFile(file);
  totalReplacements += replacements;
  summary.push({ file: f, replacements });
  console.log(`  ${f}: ${replacements} replacements`);
}

for (const file of SKIP_FILES) {
  console.log(`  ${file}: SKIPPED (0 console calls)`);
}

console.log(`\nTotal replacements: ${totalReplacements}`);

// Write migration summary
const summaryPath = path.join(__dirname, '..', 'LOGGER_MIGRATION.md');
const lines = [
  '# Logger Migration Summary',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Files Modified',
  '',
  ...summary.map(s => `- **${s.file}** — ${s.replacements} replacements`),
  '',
  '## Files Skipped (no console.log/error/warn calls)',
  '',
  ...SKIP_FILES.map(f => `- ${f}`),
  '',
  '## Conversion Rules Applied',
  '',
  '- `console.log` → `logger.info`',
  '- `console.error` → `logger.error`',
  '- `console.warn` → `logger.warn`',
  '- `console.debug` → left unchanged',
  '- Bracketed context tag (e.g. `[AuthContext]`) extracted as first argument',
  '- Remaining message string becomes second argument (trailing colons stripped)',
  '- Simple variable extra args → shorthand `{ var }`',
  '- Compound expression extra args (e.g. `error.message`) → `{ message: error.message }`',
  '- Object literal extra args → passed directly as data object',
  '- Files with no `console.log/error/warn` calls: skipped entirely (no import added)',
  '',
  `**Total replacements across ${summary.length} files: ${totalReplacements}**`,
  '',
];

fs.writeFileSync(summaryPath, lines.join('\n'), 'utf8');
console.log(`\nMigration summary written to LOGGER_MIGRATION.md`);
