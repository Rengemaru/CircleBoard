/** @type {import('tailwindcss').Config} */
// v4 の CSS-first 構成（@import "tailwindcss"）から v3 に戻したときの設定ファイル。
// smarthr-ui が tailwindcss@^3.4 に依存しているため（docs/instructions.md Phase 8）。
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
