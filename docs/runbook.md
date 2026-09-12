# 運用手順書

本番（ConoHa VPS）を触るときの手順です。設計の理由は `docs/spec-v2.2.md` §7 にあります。

VPS の `/opt/circleboard` に次のものが置いてある状態を前提にします。作り方は §1 です。

| 置くもの | 中身 |
|---|---|
| `docker-compose.prod.yml` | 本番用の Compose（リポジトリのものをそのまま） |
| `.env.production` | 実際の値。**リポジトリには入っていません**（`chmod 600`） |
| `ops/` | このリポジトリの `ops/` をそのまま |
| `log/` | cron の出力先。**空でよいが、無いと cron が動きません**（§1-7） |

長いコマンドが続くので、最初にこれを打っておくと以降が短く書けます。**ログアウトすると消えます。**

```bash
cd /opt/circleboard
alias dc='docker compose -f docker-compose.prod.yml --env-file .env.production'
```

以降 `dc` と書いてある箇所は、この別名を張っていない場合は上の長い方に読み替えてください。

---

## 1. 初回デプロイ

VPS の初期設定（非 root ユーザー / SSH 鍵 / ufw / fail2ban）が済んでいる前提です。

```bash
ssh circleboard          # 鍵だけで入れること
sudo ufw status          # 22 / 80 / 443 だけが ALLOW になっていること
docker ps                # sudo 無しで動くこと
```

### 1-1. イメージを ghcr.io に置く（開発機で）

**VPS ではビルドしません。** 2GB しかないので `npm run build` と `bundle install` でメモリが尽きます（`docs/spec-v2.2.md` §7.4）。

```bash
# 開発機で
docker build -t ghcr.io/rengemaru/circleboard-backend:latest ./backend
docker build -t ghcr.io/rengemaru/circleboard-frontend:latest ./frontend

echo <PAT> | docker login ghcr.io -u Rengemaru --password-stdin
docker push ghcr.io/rengemaru/circleboard-backend:latest
docker push ghcr.io/rengemaru/circleboard-frontend:latest
```

PAT は https://github.com/settings/tokens の classic で作り、スコープは `write:packages` だけです。

push した直後のパッケージは**非公開**です。公開に変えない場合は、**VPS 側でも `docker login ghcr.io` が要ります**（`read:packages` だけの別トークンを作ってください）。公開にすればその必要はありません。

### 1-2. ファイルを置く

```bash
# 開発機で
scp docker-compose.prod.yml circleboard:/opt/circleboard/
scp -r ops circleboard:/opt/circleboard/
scp .env.production.example circleboard:/opt/circleboard/
```

`/opt/circleboard` が無いと言われたら、先に VPS で `sudo mkdir -p /opt/circleboard && sudo chown circleboard: /opt/circleboard` を打ちます。

### 1-3. `.env.production` を書く

```bash
ssh circleboard
cd /opt/circleboard
cp .env.production.example .env.production
chmod 600 .env.production     # DBのパスワードが入る
```

鍵は**このサーバーの上で作ります**。手で考えないでください。

```bash
openssl rand -hex 24      # POSTGRES_PASSWORD 用
openssl rand -hex 64      # SECRET_KEY_BASE 用
```

`-base64` ではなく `-hex` にしているのは、`/` や `+` が混ざると `DATABASE_URL` のパスワード部分で URL の区切りと衝突するためです。

`vi .env.production` で埋める値は5か所です。

| 項目 | 入れるもの |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` の出力 |
| `DATABASE_URL` | 同じパスワードを埋め込む（**2か所に同じ値を書きます**） |
| `SECRET_KEY_BASE` | `openssl rand -hex 64` の出力 |
| `PUBLIC_BASE_URL` | `http://<VPSのIP>` |
| `ALLOWED_HOSTS` | `<VPSのIP>` |

`FORCE_SSL=false` と `SITE_ADDRESS=:80` は**ドメインを取るまでそのまま**です。ドメインを設定したら §3 を見てください。

### 1-4. 起動する

```bash
dc pull
dc up -d
dc ps          # db が healthy、backend と frontend が Up になること
```

### 1-5. DBを作る

**`db:prepare` を使わないでください。** あれは「DBが無ければ作って migrate して **seed**」なので、部員のダミーデータが本番に入ります。

```bash
dc exec -T backend bin/rails db:create db:migrate
dc exec -T backend bin/rails runner 'puts "users=#{User.count}"'   # users=0 であること
```

### 1-6. 初代管理者を作る

画面から作れるのは管理者だけなので、最初の1人はここで作ります。

```bash
dc exec -T backend bin/rails runner '
u = User.create!(name: "蓮華丸", email: "自分のメール", password: "8文字以上", role: :admin,
                 enrollment_year: User.enrollment_year_for(4),
                 graduation_year: User.graduation_year_for(4))
puts "created id=#{u.id} role=#{u.role}"'
```

`grade_years` は列ではなくメソッドなので、`User.create!(grade_years: 4)` では通りません。上の書き方（4年目 = B4）を使ってください。

パスワードはこのあと画面から変えられます（`/me/edit`）。

### 1-7. cron を登録する

```bash
mkdir -p /opt/circleboard/log      # 先に作る。無いと cron が1行も動かない
chmod +x /opt/circleboard/ops/*.sh
crontab -e                          # ops/crontab.example の中身を貼る
crontab -l                          # 入ったか確認
```

**`log/` を先に作ってください。** cron は `>> /opt/circleboard/log/backup.log` のリダイレクトを**スクリプトを起動する前に**開きます。ディレクトリが無いとリダイレクトに失敗し、**スクリプトは1行も動かないまま終わります。** しかも出力先が無いので、失敗したことも記録に残りません。

アプリのログは `dc logs` で読みます（`RAILS_LOG_TO_STDOUT=true`）。`log/` は cron 専用です。

翌朝、実際に動いたことを確認します。

```bash
tail -20 /opt/circleboard/log/backup.log
ls -l /opt/circleboard/backups/
```

### 1-8. 動いているか確かめる

まず `curl` で2つ。**ブラウザで見る前にここを通してください。** 画面が出ないときに、どの層で止まっているかの切り分けになります。

```bash
curl -i http://<VPSのIP>/healthz         # {"status":"ok"} が返る
curl -i http://<VPSのIP>/api/events      # 未ログインでも200。owner が返らないこと
```

**`/api/events` に `owner` が入っていたら止めてください。** 未ログインに企画者名を出さないのは仕様（`docs/spec-v2.2.md` §4）で、ここが漏れていると公開してはいけません。

そのあとブラウザで、実際に1周します。**ここまで通って初めて「公開URLで動く」と言えます。**

| # | 見るところ | 通ったと言える状態 |
|---|---|---|
| 1 | `http://<VPSのIP>/events` | 未ログインで一覧が出る。企画者名が出ていない |
| 2 | `/login` | §1-6 で作った管理者で入れる |
| 3 | `/create` | イベントを1件作れる。作成後に詳細へ飛ぶ |
| 4 | `/events/:id` | 自分で作ったイベントに**参加表明**できる。取り消しもできる |
| 5 | `/projects` | ログイン中は出る。**ログアウトすると 401 で弾かれる**（プロジェクトはログイン必須） |
| 6 | `/me` | プロフィールが出て、`/me/edit` から名前を変えられる |

確認用に作ったイベントは、`/admin/posts` から削除できます。

---

## 2. 更新する（2回目以降）

```bash
# 開発機で: ビルドして push（§1-1 と同じ）
# VPS で:
cd /opt/circleboard
dc pull
dc up -d
dc exec -T backend bin/rails db:migrate
```

**マイグレーションは起動時に自動で走りません**（`backend/Dockerfile` の `CMD` に入れていません）。コンテナを2つ立てたときに同時に走って事故るためです。上のように明示的に打ちます。

### 切り戻す

`.env.production` の `BACKEND_IMAGE` / `FRONTEND_IMAGE` のタグを前のものに書き換えて `dc up -d` します。

**マイグレーションを含む更新は、これだけでは戻りません。** DBのスキーマは前に進んだままなので、§4 の復元が要ります。**戻せる形にしておくために、更新の前にバックアップを1回手で取ってください。**

```bash
/opt/circleboard/ops/backup.sh
```

---

## 3. ドメインを取ったら

1. DNS の A レコードを VPS の IP に向ける
2. `.env.production` を3か所書き換える

| 項目 | 変更後 |
|---|---|
| `SITE_ADDRESS` | `circleboard.example.jp`（`:80` から） |
| `ALLOWED_HOSTS` | `circleboard.example.jp` |
| `PUBLIC_BASE_URL` | `https://circleboard.example.jp` |
| `FORCE_SSL` | **行ごと消す**（既定の `true` に戻る） |

3. `dc up -d` で入れ替える

Caddy が証明書を自動で取ります。`dc logs frontend` に取得のログが出ます。**DNS が向いていないと取れません**ので、1 を先にやってください。

---

## 4. バックアップ

### 何を、いつ取っているか

`ops/backup.sh` が毎日 4:00 に `pg_dump` を取り、`/opt/circleboard/backups/db_YYYYMMDD.sql.gz` に置きます。**14日より古いものは自動で消えます。**

cron の登録は §1-7 で済ませています。何が入っているかは `crontab -l` で見られます。

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

---

## 5. 落ちたとき

### まずこの3つ

```bash
cd /opt/circleboard
dc ps                              # どれが落ちているか
curl -i http://localhost/healthz   # 200 か。落ちていればどの層かの目星がつく
dc logs --tail=50 backend          # 直近のログ
```

`dc ps` の `STATUS` で切り分けます。

| 見えるもの | 次に見る場所 |
|---|---|
| `db` が `unhealthy` | `dc logs db`。ディスクが埋まっていないか（`df -h`） |
| `backend` が `Restarting` を繰り返す | `dc logs backend`。起動時に落ちている（下の表） |
| 全部 `Up` なのに画面が出ない | `dc logs frontend`。Caddy まで届いていない |
| コンテナが1つも無い | VPS を再起動した直後なら `dc up -d`。`restart: always` があるので通常は自動で戻る |

### 症状から当たりをつける

**ログの1行目を読んでから直してください。** 下は当たりやすい順です。

| 症状 | だいたいの原因 |
|---|---|
| `backend` が起動直後に落ちる | `.env.production` の値が欠けている。`SECRET_KEY_BASE` か `DATABASE_URL` |
| API が全部 403 | `ALLOWED_HOSTS` が今アクセスしている宛先と違う（ドメインを取った直後に起きる） |
| **ログインだけ通らない** | `FORCE_SSL` と実際のアクセス方法が食い違っている。http で見ているのに `FORCE_SSL` が `true` だと、Cookie に `secure` が付いて送り返されない |
| **サイネージだけ 500** | `PUBLIC_BASE_URL` が未設定。`ENV.fetch` に既定値が無いので、その画面だけ落ちる |
| 画面は出るが API が 502 | `backend` が落ちている。`dc logs backend` |
| 何をしても 413 | 送っている本文が 1MB を超えている（Caddy の `request_body max_size`） |
| 突然全部が不調 | ディスクを疑う。`df -h` → 埋まっていれば `docker system prune -a` と古いバックアップの整理 |

### 戻し方

```bash
dc restart backend     # だいたいこれで戻る
dc up -d               # 設定を変えたあとはこちら（コンテナを作り直す）
```

**`.env.production` を書き換えたときは `restart` では反映されません。** 環境変数はコンテナを作るときに渡されるので、`up -d` が要ります。

それでも直らないときは、イメージのタグを前のものに戻します（§2 の切り戻し）。

### ログを後から追う

```bash
dc logs -f backend                 # 流しっぱなしで見る
dc logs --since 1h backend         # 直近1時間だけ
dc logs backend | grep -i error
```

アプリのログはファイルに残りません（`RAILS_LOG_TO_STDOUT=true`）。**コンテナを作り直すと消えます。** 原因を調べている途中で `up -d` を打つ前に、必要な行は手元に控えてください。
