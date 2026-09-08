// v3 は Vite プラグインではなく PostCSS 経由で動く。
// Vite はこのファイルを自動で読むので、vite.config.ts 側の設定は要らない。
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
