#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/islands", "src/components"];
const EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

// Server-only files are intentionally excluded from this checker.
const SERVER_ALLOWLIST = ["src/pages/api/", "src/lib/ai.ts"];

const DISALLOWED_RULES = [
  {
    name: "AI SDK client imports",
    test: (specifier) => specifier === "ai" || specifier.startsWith("@ai-sdk/"),
    hint: "Use server API routes for AI calls; keep islands on plain fetch.",
  },
  {
    name: "Better Auth React client import",
    test: (specifier) =>
      specifier === "better-auth/react" || specifier.startsWith("better-auth/react/"),
    hint: "Call auth endpoints from islands instead of importing better-auth/react.",
  },
  {
    name: "Node runtime module",
    test: (specifier) => {
      if (specifier.startsWith("node:")) return true;
      const root = specifier.split("/")[0];
      return NODE_RUNTIME_MODULES.has(root);
    },
    hint: "Node runtime modules must stay in server-only code.",
  },
];

const NODE_RUNTIME_MODULES = new Set([
  "assert",
  "buffer",
  "child_process",
  "crypto",
  "events",
  "fs",
  "http",
  "https",
  "net",
  "os",
  "path",
  "stream",
  "url",
  "util",
  "worker_threads",
  "zlib",
]);

const PATTERNS = [
  /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
  /\bexport\s+[\s\S]*?\s+from\s+["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
];

async function walkFiles(dir, results = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, results);
      continue;
    }
    if (!entry.isFile()) continue;
    if (EXTENSIONS.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function toWorkspacePath(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function isServerAllowlisted(relPath) {
  return SERVER_ALLOWLIST.some((allowed) => relPath === allowed || relPath.startsWith(allowed));
}

function getLineNumber(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function collectImportMatches(content) {
  const matches = [];
  for (const pattern of PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      matches.push({
        specifier: match[1],
        index: match.index,
      });
    }
  }
  return matches;
}

async function main() {
  const files = (
    await Promise.all(SCAN_DIRS.map((dir) => walkFiles(path.join(ROOT, dir))))
  ).flat();

  const violations = [];

  for (const file of files) {
    const relPath = toWorkspacePath(file);
    if (isServerAllowlisted(relPath)) continue;

    const content = await readFile(file, "utf8");
    const imports = collectImportMatches(content);

    for (const item of imports) {
      const rule = DISALLOWED_RULES.find((r) => r.test(item.specifier));
      if (!rule) continue;
      violations.push({
        file: relPath,
        line: getLineNumber(content, item.index),
        specifier: item.specifier,
        rule: rule.name,
        hint: rule.hint,
      });
    }
  }

  if (violations.length === 0) {
    console.log(
      `check-client-boundaries: OK (${files.length} files scanned across ${SCAN_DIRS.join(", ")})`,
    );
    return;
  }

  console.error("check-client-boundaries: found forbidden imports in client-hydrated code:");
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line}`);
    console.error(`  import: "${v.specifier}"`);
    console.error(`  rule: ${v.rule}`);
    console.error(`  fix: ${v.hint}`);
  }

  process.exitCode = 1;
}

main().catch((error) => {
  console.error("check-client-boundaries: failed to run");
  console.error(error);
  process.exit(1);
});
