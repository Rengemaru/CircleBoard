#!/bin/bash
#
# 注目スコアの日次更新(docs/spec-v2.2.md §3.4)。ホスト側 cron から呼ぶ。
#
# **backend/config/schedule.rb(whenever)は本番では動かない。** 実行イメージは
# ruby:3.3-slim で cron が入っておらず、whenever --update-crontab を打つ相手が
# いない。whenever は crontab を生成するだけの gem なので、生成先が要る。
# ホスト側の crontab から docker compose exec する形にした。
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/circleboard}
cd "${APP_DIR}"

echo "[$(date '+%F %T')] 注目スコアの再計算を開始"

docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T backend bin/rails runner 'Event.recalculate_spotlight_scores'

echo "[$(date '+%F %T')] 完了"
