# 運用手順書

本番（ConoHa VPS）を触るときの手順です。設計の理由は `docs/spec-v2.2.md` §7 にあります。

前提として、VPS には `/opt/circleboard` に次のものが置いてあります。

| 置くもの | 中身 |
|---|---|
| `docker-compose.prod.yml` | 本番用の Compose（リポジトリのものをそのまま） |
| `.env.production` | 実際の値。**リポジトリには入っていません**（`chmod 600`） |
| `ops/` | このリポジトリの `ops/` をそのまま |
| `log/` | cron の出力先。**空でよいが、無いと cron が動きません**（下記） |

### 置いたあとに1回だけやること

```bash
ssh circleboard
mkdir -p /opt/circleboard/log
chmod +x /opt/circleboard/ops/*.sh
```

**`log/` を先に作ってください。** cron は `>> /opt/circleboard/log/backup.log` のリダイレクトを**スクリプトを起動する前に**開きます。ディレクトリが無いとリダイレクトに失敗し、**`backup.sh` は1行も動かないまま終わります。** しかも出力先が無いので、失敗したことも記録に残りません。

アプリのログは `docker compose logs` で読みます（`RAILS_LOG_TO_STDOUT=true`）。`log/` は cron 専用です。

---

## 1. バックアップ

### 何を、いつ取っているか

`ops/backup.sh` が毎日 4:00 に `pg_dump` を取り、`/opt/circleboard/backups/db_YYYYMMDD.sql.gz` に置きます。**14日より古いものは自動で消えます。**

cron の登録内容は `ops/crontab.example` にあります。`crontab -e` で貼ってください。

```bash
crontab -l    # いま何が登録されているか
```

### 手で1回取る

```bash
ssh circleboard
/opt/circleboard/ops/backup.sh
ls -l /opt/circleboard/backups/
```

うまくいけば `完了 1.2M` のように出ます。**`ls` でファイルが `-rw-------`（600）になっていることも見てください。** ダンプには部員の氏名・メールアドレス・パスワードのダイジェストが入っています。

### 動いているかを確かめる

cron は失敗しても何も言いません。**ログを見るのが唯一の確認手段です。**

```bash
tail -20 /opt/circleboard/log/backup.log
ls -l /opt/circleboard/backups/        # 今日の日付のファイルがあるか
```

日付が飛んでいたら、その日は取れていません。

### VPS の外へ逃がす

**VPS が飛べばバックアップも一緒に消えます。** 週1回、手元に引いてください。自動化していないのは、退避先の認証情報をサーバーに置くと、サーバーを取られたときに退避先まで一緒に取られるためです。

```bash
# 手元（開発機）で打つ
scp circleboard:/opt/circleboard/backups/db_$(date +%Y%m%d).sql.gz .
```

### 復元する

**取れているかどうかは、戻せて初めて分かります。** 手順は次のとおりです。

```bash
cd /opt/circleboard

# 1. 復元先の空のDBを作る（既存のDBには直接流さない）
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T db psql -U circleboard -d postgres -c "CREATE DATABASE restore_check;"

# 2. 流し込む。ON_ERROR_STOP=1 を付けると途中で失敗したときに止まる
gzip -dc backups/db_20260912.sql.gz | \
  docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T db psql -v ON_ERROR_STOP=1 -U circleboard -d restore_check

# 3. 件数を突き合わせる
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T db psql -U circleboard -d restore_check \
  -c "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM events) AS events;"
```

**本番のDBに直接流し戻さないでください。** まず `restore_check` に入れて中身を見て、それから `.env.production` の `DATABASE_URL` を差し替えるか、`DROP DATABASE` してから改めて流します。壊れたダンプを本番に上書きすると、取り返しがつきません。

確認が済んだら消します。

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  exec -T db psql -U circleboard -d postgres -c "DROP DATABASE restore_check;"
```
