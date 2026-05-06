/**
 * Static-analysis import tests.
 *
 * For every source file we:
 *   1. Parse all import declarations → identifiers brought into scope.
 *   2. Parse local definitions (function/const/class) → also in scope.
 *   3. Find every JSX component reference (<Capitalized …>) → must be in scope.
 *   4. Find every call to a known project-utility function → must be in scope.
 *
 * This catches the class of bug where a component is split out of a larger
 * file but keeps using identifiers that were only imported by the old parent.
 */

// If you add a new utility to Utilities.js, add its name to the PROJECT_UTILS set in imports.test.js to keep coverage complete.

import { describe, it, expect } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative } from 'path';

const SRC = resolve(import.meta.dir);

// ─── Filesystem helpers ───────────────────────────────────────────────────────

function readSrc(relPath) {
  return readFileSync(join(SRC, relPath), 'utf8');
}

function allSourceFiles() {
  const results = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (/\.(jsx?)$/.test(entry) && !entry.includes('.test.')) {
        results.push(relative(SRC, full));
      }
    }
  }
  walk(SRC);
  return results;
}

// ─── Strip block/line comments ────────────────────────────────────────────────
// We strip comments before scanning so that commented-out code doesn't trigger
// false positives. We do NOT strip strings — doing so breaks the import regex
// because empty string paths fail to match `['"][^'"]+['"]`.

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/[^\n]*/g, '');         // line comments
}

// ─── Identifiers in scope ─────────────────────────────────────────────────────

/**
 * Parse import declarations and return every identifier they bring into scope.
 *
 * Handles:
 *   import Foo from '…'                → Foo
 *   import { Foo, Bar as B } from '…'  → Foo, B
 *   import * as NS from '…'            → NS
 *   import Def, { Named } from '…'     → Def, Named
 *   import '…'                         → (side-effect, no bindings)
 */
function importedIdentifiers(source) {
  const ids = new Set();
  // Match the full import statement. We allow any characters between
  // `import` and `from '…'`, including newlines (for multi-line named imports).
  const importRe = /^import\s+([\s\S]*?)\s+from\s+['"`][^'"`]*['"`]/gm;
  let m;
  while ((m = importRe.exec(source)) !== null) {
    const clause = m[1].trim();

    // import * as Foo
    const ns = clause.match(/^\*\s+as\s+(\w+)$/);
    if (ns) { ids.add(ns[1]); continue; }

    let rest = clause;

    // Strip leading default import (a bare identifier before an optional comma)
    const defaultMatch = rest.match(/^(\w+)\s*(?:,\s*)?/);
    if (defaultMatch && !rest.startsWith('{')) {
      ids.add(defaultMatch[1]);
      rest = rest.slice(defaultMatch[0].length).trim();
    }

    // Named imports { Foo, Bar as B, … }
    const namedBlock = rest.match(/\{([^}]+)\}/);
    if (namedBlock) {
      for (const part of namedBlock[1].split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        // "originalName as alias" — the alias is what enters scope
        const alias = trimmed.match(/(?:\w+\s+as\s+)?(\w+)$/);
        if (alias) ids.add(alias[1]);
      }
    }
  }
  return ids;
}

/**
 * Return identifiers that are locally defined in the file (not imported).
 * These are in scope and do not require an import statement.
 */
function locallyDefinedIdentifiers(source) {
  const ids = new Set();
  const patterns = [
    // function foo(   /  async function foo(   /  export function foo(
    /(?:^|\s)(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm,
    // const/let/var foo =
    /(?:^|\s)(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[=(:]/gm,
    // class Foo
    /(?:^|\s)(?:export\s+)?(?:default\s+)?class\s+(\w+)/gm,
  ];
  let m;
  for (const re of patterns) {
    while ((m = re.exec(source)) !== null) {
      if (m[1]) ids.add(m[1]);
    }
  }
  return ids;
}

function identifiersInScope(source) {
  const scope = importedIdentifiers(source);
  for (const id of locallyDefinedIdentifiers(source)) scope.add(id);
  return scope;
}

// ─── What the file actually uses ─────────────────────────────────────────────

/**
 * Find all JSX element names starting with a capital letter.
 * These are React components and must be in scope.
 */
function jsxComponentNames(source) {
  const names = new Set();
  const re = /<([A-Z][A-Za-z0-9]*)/g;
  let m;
  while ((m = re.exec(source)) !== null) names.add(m[1]);
  return names;
}

/**
 * Known utility functions exported from project modules.
 * Any file that calls one of these must have it in scope.
 */
const PROJECT_UTILS = new Set([
  'uid', 'buildURL', 'parseURL', 'makeProvider',
  'serializeConfig', 'parseConfig', 'validate', 'getModelHint',
]);

function projectUtilCalls(source) {
  const found = new Set();
  for (const name of PROJECT_UTILS) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(source)) found.add(name);
  }
  return found;
}

// ─── Tests (generated per file) ───────────────────────────────────────────────

const files = allSourceFiles();

for (const file of files) {
  const raw = readSrc(file);
  const source = stripComments(raw);
  const scope = identifiersInScope(source);
  const components = jsxComponentNames(source);
  const utils = projectUtilCalls(source);

  describe(`${file}`, () => {

    for (const name of components) {
      // <AppCtx.Provider> — root identifier is AppCtx, .Provider is a property
      const rootName = name.split('.')[0];
      it(`JSX <${name}> is in scope`, () => {
        expect(scope.has(rootName)).toBe(true);
      });
    }

    for (const name of utils) {
      it(`utility \`${name}\` is in scope`, () => {
        expect(scope.has(name)).toBe(true);
      });
    }

  });
}
