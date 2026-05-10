import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktree snapshots — not part of the main codebase:
    ".claude/worktrees/**",
    // CommonJS scripts and docs tooling — not Next.js app code:
    "scripts/**",
    "docs/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
