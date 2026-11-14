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
  ]),
  {
    // D1 rows and provider payloads are untyped JSON. Warn (do not fail) on `any` in route handlers so
    // new code is nudged toward real types without blocking on the existing handlers.
    files: ["app/api/**/*.ts", "app/access-control.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
  {
    // The dashboards load data on mount and on trade change by design. Keep these visible as warnings.
    files: ["app/dashboard.jsx", "app/command-dashboard.jsx"],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
