import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// server.host はここで指定しない。Dockerfile.dev の CMD が --host 0.0.0.0 を渡すため、
// ここにも書くと二重管理になる。
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
