# 本番用イメージ。開発用は Dockerfile.dev（Vite の dev server）で別物。
#
# 本番に Node.js は置かない(docs/spec-v2.2.md §7.2)。React はビルド済みの
# 静的ファイルにして、Caddy が直接配信する。このイメージが「フロント」であり、
# 同時に入口の Web サーバーでもある。
#
# ビルドは GitHub Actions 側で行う(§7.4/§7.7)。VPS で npm run build を
# 走らせるとメモリ不足で落ちる。

# --- Stage 1: React をビルドする ---
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Vite の環境変数は**ビルド時にコードへ埋め込まれる**。実行時の環境変数では
# 差し替えられないので、値をビルド引数で受ける。
#
# 既定を空文字にしているのは、本番ではフロントとAPIが同じオリジンだから。
# apiFetch は `${BASE_URL}/api/...` を組み立てるので、空なら /api/... という
# 相対パスになり、Caddy が同じホストの backend へ流す(§7.3)。
# 開発環境だけが http://localhost:3000 という別オリジンを使う。
ARG VITE_API_BASE_URL=""
ARG VITE_PUBLIC_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_PUBLIC_BASE_URL=${VITE_PUBLIC_BASE_URL}

# package.json だけを先に入れる。ソースを変えただけのときに
# npm ci の層を作り直さずに済む
COPY package.json package-lock.json ./
# npm install ではなく npm ci。package-lock.json のとおりに入れ、
# ビルドのたびに依存のバージョンが変わらないようにする
RUN npm ci

COPY . .

# npm run build は tsc -b && vite build。型エラーがあればここで落ちる
RUN npm run build

# --- Stage 2: 静的配信 ---
FROM caddy:2-alpine AS runtime

# ビルド結果だけを持っていく。node_modules もソースも最終イメージに残さない
COPY --from=builder /app/dist /srv/public
COPY Caddyfile /etc/caddy/Caddyfile
