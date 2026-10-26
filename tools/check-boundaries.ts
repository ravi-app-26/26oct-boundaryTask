import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export interface Violation { file: string; importPath: string; reason: string }

const isFile = (p: string) => fs.statSync(p, { throwIfNoEntry: false })?.isFile() ?? false;

export function findViolations(root: string): Violation[] {
  const modulesDir = path.resolve(root, "src/modules");
  const platformDir = path.resolve(root, "src/platform");
  const inDir = (dir: string, p: string) => p.startsWith(dir + path.sep);
  const moduleOf = (f: string) => {
    const [name, rest] = path.relative(modulesDir, f).split(path.sep);
    return rest ? name : null;
  };

  const files = fs.existsSync(modulesDir)
    ? fs.readdirSync(modulesDir, { recursive: true })
        .map(f => path.join(modulesDir, String(f)))
        .filter(f => f.endsWith(".ts") && isFile(f))
    : [];

  // import, export-from aur type-only imports
  const importRe = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g;
  const violations: Violation[] = [];

  for (const file of files) {
    for (const [, importPath] of fs.readFileSync(file, "utf8").matchAll(importRe)) {
      if (!importPath.startsWith(".")) continue;

      const base = path.resolve(path.dirname(file), importPath);
      const target = [base, `${base}.ts`, path.join(base, "index.ts")].find(isFile);

      const reason =
        !target ? "Import target could not be resolved"
        : inDir(platformDir, target) ? null
        : !inDir(modulesDir, target) ? "Module imports a file outside src/modules and src/platform"
        : moduleOf(target) === moduleOf(file) ||
          (moduleOf(target) && path.basename(target) === "index.ts") ? null
        : "Cross-module imports must go through the target module's index.ts";

      if (reason) violations.push({ file, importPath, reason });
    }
  }
  return violations;
}

// Direct run
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const violations = findViolations(process.cwd());
  violations.length ? console.error(JSON.stringify(violations, null, 2)) : console.log("No boundary violations found.");
  process.exitCode = violations.length ? 1 : 0;
}