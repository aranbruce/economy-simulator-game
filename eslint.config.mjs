import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tailwindcss from "eslint-plugin-tailwindcss";
import prettier from "eslint-config-prettier";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "public/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ...tailwindcss.configs.recommended,
    settings: {
      tailwindcss: {
        cssConfigPath: "./app/globals.css",
      },
    },
    rules: {
      ...tailwindcss.configs.recommended.rules,
      // Codebase mixes Tailwind utilities with a legacy hand-authored CSS
      // system (chip, panel, coach-panel-*, ...) by design — see CLAUDE.md.
      // That migration is tracked separately; this rule can't tell a real
      // typo from an intentional legacy class, so it's pure noise here.
      "tailwindcss/no-custom-classname": "off",
      // This project has no numeric --leading-* theme scale, so the rule's
      // suggested fix for line-height (leading-[1.4] -> leading-[1.4]) and
      // for scale (scale-[0.98] -> scale-[0.98]) silently compiles to nothing
      // instead of the intended value. Confirmed broken via compiled CSS
      // output for both utility families; not safe to autofix here. Spacing-
      // scale utilities (gap/p/m/w/h/...) and named-token matches (like
      // tracking-widest) are unaffected and were fixed by hand instead.
      "tailwindcss/no-unnecessary-arbitrary-value": "off",
    },
  },
  {
    rules: {
      // engine.ts is typed loosely at the legacy-JS boundary by design
      // (CLAUDE.md: "TypeScript migration") — keep as signal, not a hard fail.
      "@typescript-eslint/no-explicit-any": "warn",
      // These target React Compiler adoption. The app's whole state model is
      // direct mutation of a global `G` object (CLAUDE.md: "central data
      // structure") plus refs mutated outside render, so they fire on the
      // architecture itself rather than on bugs.
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  prettier,
];

export default config;
