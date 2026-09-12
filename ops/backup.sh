#!/bin/bash
#
# 日次バックアップ(docs/spec-v2.2.md §7.6)。VPS のホスト側 cron から呼ぶ。
# 反映のしかたは ops/crontab.example を参照。
#
#   実行: /opt/circleboard/ops/backup.sh
#
# コンテナの中で動かさない。db コンテナを作り直しても消えない場所に置きたいのと、
# 「バックアップを取る役」が落ちていることに気づけなくなるため。
set -euo pipefail

# **このスクリプトが作るものは本人しか読めないようにする。**
# ダンプには部員の氏名・メールアドレス・パスワードのダイジェストが入る。
# Ubuntu の既定 umask は 022 で、何もしないとディレクトリ 755 /
# ファイル 644 になり、同じサーバーにログインできる人なら誰でも読める。
umask 077

APP_DIR=${APP_DIR:-/opt/circleboard}
BACKUP_DIR=${BACKUP_DIR:-${APP_DIR}/backups}
# 何日分を残すか。find の -mtime に渡す
GENERATIONS=${GENERATIONS:-14}

cd "${APP_DIR}"

mkdir -p "${BACKUP_DIR}"
# umask は「これから作るもの」にしか効かない。前のやり方で作られた
# ディレクトリが既にある場合のために、ここでも閉じておく
chmod 700 "${BACKUP_DIR}"
STAMP=$(date +%Y%m%d)
DEST="${BACKUP_DIR}/db_${STAMP}.sql.gz"
TMP="${BACKUP_DIR}/.db_${STAMP}.sql.gz.part"
# 失敗して抜けたときに書きかけを残さない。翌日以降まで居座ると
# 「何か取れているように見えるファイル」が増える
trap 'rm -f "${TMP}"' EXIT

echo "[$(date '+%F %T')] バックアップ開始 -> ${DEST}"

# **一旦 .part に書いてから rename する。** pg_dump が途中で失敗したときに
# 壊れたファイルが db_YYYYMMDD.sql.gz として残ると、世代管理の上では
# 「その日の分は取れている」ように見えてしまう。
# pipefail を入れているので、pg_dump が落ちれば gzip が成功しても止まる。
#
# **DB名とユーザーは db コンテナの中の環境変数から取る。** シングルクォート
# なので $POSTGRES_USER はホストではなくコンテナの中で展開される。
# .env.production をこのスクリプトで読み込まないのは、あれがシェルの
# ファイルではないため。source すると値に含まれる記号(< > $ ` など)を
# シェルが解釈して落ちる。雛形の <VPSのIP> で実際に落ちた
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "${TMP}"

# 展開できることまで確かめる。0バイトや途中で切れた gz をここで弾く
gzip -t "${TMP}"
mv "${TMP}" "${DEST}"

echo "[$(date '+%F %T')] 完了 $(du -h "${DEST}" | cut -f1)"

# 古い世代を消す。消すのは rename 済みのファイルだけで、.part は対象外
find "${BACKUP_DIR}" -name 'db_*.sql.gz' -mtime "+${GENERATIONS}" -delete

# **これだけでは足りない。** VPS が飛べばバックアップも一緒に消える(§7.6)。
# 週1回、手元へ退避する:
#   scp circleboard:/opt/circleboard/backups/db_$(date +%Y%m%d).sql.gz .
