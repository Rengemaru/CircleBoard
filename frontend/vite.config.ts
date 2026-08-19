import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// server.host はここで指定しない。Dockerfile.dev の CMD が --host 0.0.0.0 を渡すため、
// ここにも書くと二重管理になる。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      // Docker のバインドマウント越しではホスト側のファイル変更イベントが
      // コンテナ内に伝わらず、ソースを直しても Vite が古いコードを配信し続ける
      // (実際に踏んだ)。ポーリングで検知させる。開発用の設定で、本番ビルドには影響しない。
      usePolling: true,
    },
  },
});
