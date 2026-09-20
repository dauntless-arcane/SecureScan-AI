import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// Safety limits for remediation context sent to the AI. These exist so a
// large repository can't blow up the prompt size; when a limit is hit we
// keep the primary file (always) and drop the least-directly-relevant
// dependencies rather than silently including unrelated files.
export const CONTEXT_LIMITS = Object.freeze({
  MAX_PRIMARY_FILE_BYTES: 60_000,
  MAX_DEPENDENCY_COUNT: 5,
  MAX_DEPENDENCY_FILE_BYTES: 20_000,
  MAX_TOTAL_CONTEXT_BYTES: 120_000,
});

const TRUNCATION_NOTICE = '\n\n/* ... truncated: file exceeds remediation context size limit ... */\n';

/**
 * Builds (or reuses, via `fileCache`) the remediation context for one Semgrep
 * finding: the entire affected file plus its resolvable local dependencies.
 * Must run against `workspacePath` before that clone is deleted.
 *
 * `fileCache` is a Map<relativePath, { content, truncated }> shared across
 * findings in the same scan so the same primary file is only read/stored once
 * even when several findings point at it.
 *
 * Returns a "pointer" record (paths only) — callers resolve actual file
 * contents from `fileCache` when assembling the final AI-facing context.
 */
export async function buildFindingContext(finding, workspacePath, fileCache) {
  const primaryPath = finding.file;

  await loadIntoCache(fileCache, primaryPath, workspacePath, CONTEXT_LIMITS.MAX_PRIMARY_FILE_BYTES);
  const primaryEntry = fileCache.get(primaryPath);

  const dependencyPaths = [];
  if (primaryEntry?.content && isPython(primaryPath)) {
    const candidates = resolveLocalPythonImports(primaryEntry.content, primaryPath, workspacePath);

    let budget =
      CONTEXT_LIMITS.MAX_TOTAL_CONTEXT_BYTES - Math.min(primaryEntry.content.length, CONTEXT_LIMITS.MAX_PRIMARY_FILE_BYTES);

    for (const depPath of candidates) {
      if (dependencyPaths.length >= CONTEXT_LIMITS.MAX_DEPENDENCY_COUNT) break;
      if (depPath === primaryPath || dependencyPaths.includes(depPath)) continue;
      if (budget <= 0) break;

      await loadIntoCache(fileCache, depPath, workspacePath, CONTEXT_LIMITS.MAX_DEPENDENCY_FILE_BYTES);
      const depEntry = fileCache.get(depPath);
      if (!depEntry) continue; // unresolved / didn't exist inside the workspace

      dependencyPaths.push(depPath);
      budget -= depEntry.content.length;
    }
  }

  return { primaryPath, dependencyPaths };
}

/** Assembles the AI-facing context object for one finding from cached file contents. */
export function assembleContext(finding, pointer, fileCache) {
  const primaryEntry = fileCache.get(pointer.primaryPath);

  return {
    finding: {
      rule_id: finding.rule_id,
      message: finding.message,
      severity: finding.severity,
      file: finding.file,
      start_line: finding.start_line,
      end_line: finding.end_line,
    },
    primary_file: primaryEntry
      ? { path: pointer.primaryPath, content: primaryEntry.content, truncated: primaryEntry.truncated }
      : null,
    dependencies: pointer.dependencyPaths
      .map((depPath) => {
        const entry = fileCache.get(depPath);
        return entry ? { path: depPath, content: entry.content, truncated: entry.truncated } : null;
      })
      .filter(Boolean),
  };
}

async function loadIntoCache(fileCache, relPath, workspacePath, maxBytes) {
  if (fileCache.has(relPath)) return;

  const absPath = toSafeAbsolutePath(relPath, workspacePath);
  if (!absPath) return;

  try {
    const info = await stat(absPath);
    if (!info.isFile()) return;

    const raw = await readFile(absPath, 'utf8');
    const truncated = raw.length > maxBytes;
    const content = truncated ? raw.slice(0, maxBytes) + TRUNCATION_NOTICE : raw;

    fileCache.set(relPath, { content, truncated });
  } catch {
    // File missing/unreadable — treat as unresolved rather than failing the scan.
  }
}

/** Resolves `relPath` (POSIX-style, workspace-relative) and guards against path traversal. */
function toSafeAbsolutePath(relPath, workspacePath) {
  const absWorkspace = path.resolve(workspacePath);
  const absPath = path.resolve(absWorkspace, relPath);

  if (absPath !== absWorkspace && !absPath.startsWith(absWorkspace + path.sep)) {
    return null; // would escape the cloned workspace
  }
  return absPath;
}

function isPython(relPath) {
  return relPath.endsWith('.py');
}

/**
 * Conservative, static (no code execution) resolution of a Python file's
 * local, in-repo imports. Only `import a.b.c` and `from a.b import c`
 * (absolute or relative, dotted) statements are considered. A module resolves
 * to a dependency only if a matching `.py` file or package `__init__.py`
 * actually exists inside the cloned workspace — this naturally excludes the
 * standard library and third-party/site-packages modules, since those aren't
 * present in the clone.
 */
function resolveLocalPythonImports(source, primaryRelPath, workspacePath) {
  const importRegex = /^\s*import\s+([\w.]+)/gm;
  const fromImportRegex = /^\s*from\s+(\.*)([\w.]*)\s+import\s+/gm;

  const primaryDir = path.posix.dirname(primaryRelPath.split(path.sep).join('/'));
  const resolved = [];
  const seen = new Set();

  const tryResolve = (relPath) => {
    const absPath = toSafeAbsolutePath(relPath, workspacePath);
    return absPath ? relPath : null;
  };

  const addCandidate = (relPath) => {
    if (!relPath || seen.has(relPath)) return;
    seen.add(relPath);
    resolved.push(relPath);
  };

  let match;

  while ((match = importRegex.exec(source))) {
    const dotted = match[1];
    const asPath = dotted.split('.').join('/');
    addCandidate(tryResolve(`${asPath}.py`));
    addCandidate(tryResolve(`${asPath}/__init__.py`));
  }

  while ((match = fromImportRegex.exec(source))) {
    const dots = match[1]; // leading dots for relative imports, e.g. "..", or "" for absolute
    const dotted = match[2]; // module path after the dots, may be empty ("from . import x")

    let baseDir;
    if (dots.length > 0) {
      // One leading dot = current package (the primary file's directory);
      // each extra dot walks one directory further up.
      baseDir = primaryDir;
      for (let i = 1; i < dots.length; i += 1) {
        baseDir = path.posix.dirname(baseDir);
      }
    } else {
      baseDir = '.'; // absolute import, resolved from the workspace root
    }

    const modulePath = dotted ? dotted.split('.').join('/') : '';
    const asPath = modulePath ? path.posix.join(baseDir, modulePath) : baseDir;

    addCandidate(tryResolve(`${asPath}.py`));
    addCandidate(tryResolve(`${asPath}/__init__.py`));
  }

  return resolved;
}
