import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Existing provider payloads and design workflows are progressively typed.
    // New infrastructure and tests retain the strict default rule.
    files: [
      "src/features/workspace/hooks/use-workspace.ts",
      "src/features/workspace/views/**/*.tsx",
      "src/components/composer/**/*.tsx",
      "src/components/calendar/**/*.tsx",
      "src/components/leads/**/*.tsx",
      "src/components/composer/canvas-renderer.ts",
      "src/lib/comfy-client.ts",
      "src/lib/video-generators.ts",
      "src/lib/generators.ts",
      "src/lib/concept-studio.ts",
      "src/lib/leads-service.ts",
      "src/lib/llm.ts",
      "src/lib/facebook-native.ts",
      "src/lib/fetch-helper.ts",
      "src/app/api/**/route.ts",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".refactor-backup/**",
    "canva-integration/**",
    "scratch/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
