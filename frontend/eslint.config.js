import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // any を禁止する(CLAUDE.md §4)。必要なら unknown + 絞り込みを使う
      "@typescript-eslint/no-explicit-any": "error",

      // localStorage / sessionStorage を使わない(CLAUDE.md §4)。
      // 認証はサーバー側セッション + Cookie で行うため、トークンを保存する場所が要らない
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "認証はCookieセッションで行う。CLAUDE.md §4" },
        { name: "sessionStorage", message: "認証はCookieセッションで行う。CLAUDE.md §4" },
      ],
    },
  },
  // Prettier と競合する整形系ルールを無効化する。最後に置く必要がある
  prettier,
);
