# 本番用イメージ。開発用は Dockerfile.dev（バインドマウント前提）で別物。
#
# このイメージは GitHub Actions でビルドしてレジストリに置き、VPS は pull する
# だけにする(docs/spec-v2.2.md §7.4/§7.7)。VPS は 2GB しかなく、そこで
# docker build を走らせるとメモリ不足で落ちる。ビルド用のツールを最終イメージに
# 残さないためにステージを2つに分けている。

# --- Stage 1: gem をビルドする ---
FROM ruby:3.3-slim AS builder

# build-essential と libpq-dev は pg gem のネイティブ拡張をビルドするのに要る。
# 実行時には要らないので、このステージに閉じ込める
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# BUNDLE_DEPLOYMENT=1 は Gemfile.lock と食い違ったらビルドを失敗させる設定。
# 本番で lock を勝手に書き換えて解決されるより、ここで落ちた方がよい
ENV BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT=development:test \
    BUNDLE_DEPLOYMENT=1

# Gemfile だけを先に入れる。アプリのコードを変えただけのときに
# bundle install の層を作り直さずに済む
COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git

COPY . .

# bootsnap のキャッシュを焼いておく。起動のたびに同じコンパイルをしない
RUN bundle exec bootsnap precompile app/ lib/

# --- Stage 2: 実行イメージ ---
FROM ruby:3.3-slim AS runtime

# libpq5 は pg gem が実行時に使う共有ライブラリ。開発用に入れている
# build-essential / libpq-dev / postgresql-client はここには入れない。
# バックアップの pg_dump は db コンテナ側で動かす(§7.6)
RUN apt-get update -qq && apt-get install -y --no-install-recommends \
      libpq5 \
    && rm -rf /var/lib/apt/lists/*

# root で動かさない。侵入されたときにコンテナ内で書き換えられる範囲を狭める
RUN groupadd --system --gid 1000 rails && \
    useradd --system --uid 1000 --gid rails --create-home rails

WORKDIR /app

# RAILS_LOG_TO_STDOUT: ログはファイルに書かず docker logs で読む。
# 秘密情報(RAILS_MASTER_KEY / SECRET_KEY_BASE / DATABASE_URL)はイメージに
# 焼かない。実行時に環境変数で渡す(CLAUDE.md §3-5、§7.5 A-7)
ENV RAILS_ENV=production \
    RAILS_LOG_TO_STDOUT=true \
    BUNDLE_PATH=/usr/local/bundle \
    BUNDLE_WITHOUT=development:test \
    BUNDLE_DEPLOYMENT=1

COPY --from=builder --chown=rails:rails /usr/local/bundle /usr/local/bundle
COPY --from=builder --chown=rails:rails /app /app

USER rails

EXPOSE 3000

# マイグレーションはここで走らせない。デプロイ手順の中で明示的に実行する(§7.7)。
# 起動のたびに走らせると、コンテナを2つ立てたときに同時に走って事故る
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
