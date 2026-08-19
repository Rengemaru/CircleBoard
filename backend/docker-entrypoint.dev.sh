#!/bin/bash
# 開発用コンテナの起動手順。本番では使わない(本番は Phase 5 で別途作る)。
#
# gem はバインドマウント外の名前付きボリュームに入れているため、
# 新しい環境や docker compose down -v の直後には空になっている。
# 毎回入れ直すと遅いので、足りないときだけ入れる。
set -e

if [ ! -f bin/rails ]; then
  echo "[dev] Rails app not generated yet. Waiting."
  sleep infinity
fi

echo "[dev] checking gems..."
bundle check || bundle install

# DBの作成・マイグレーション・(未投入なら)seed をまとめて行う。
# 何度実行しても壊れない。
echo "[dev] preparing database..."
bin/rails db:prepare

# テスト用DBは db:prepare の対象外(development しか見ない)。
# 作っておかないと、clone 直後に rspec を叩いた人が NoDatabaseError を踏む。
echo "[dev] preparing test database..."
bin/rails db:test:prepare

# コンテナを restart するとプロセスは消えるが、バインドマウント上の pid は
# 残る。Puma が "A server is already running" で起動を拒否するため消しておく。
rm -f tmp/pids/server.pid

echo "[dev] starting puma on 0.0.0.0:3000"
exec bin/rails server -b 0.0.0.0 -p 3000
