#!/bin/bash
# 開発用コンテナの起動手順。本番では使わない(本番は React をビルドして Caddy が配信する)。
set -e

if [ ! -f package.json ]; then
  echo "[dev] Vite app not generated yet. Waiting."
  sleep infinity
fi

# node_modules は名前付きボリュームなので、新しい環境では空になっている。
# vite の実行ファイルが無いときだけ入れる。
if [ ! -x node_modules/.bin/vite ]; then
  echo "[dev] installing npm packages..."
  npm install
fi

echo "[dev] starting vite on 0.0.0.0:5173"
exec npm run dev -- --host 0.0.0.0
