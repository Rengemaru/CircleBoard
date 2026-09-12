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

**この節はサーバーを新しく建て直すときのものです。** 現在動いている本番の作り方の記録でもあります。いまの本番に対する日々の更新は §2、ドメインと HTTPS の設定値は §3 を見てください。

`<VPSのIP>` は建てたサーバーのIPに読み替えます（現在の本番は `160.251.200.200`）。ドメインを先に用意できるなら、§3 の値を §1-3 の時点で入れてしまって構いません。

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

### 1-9. サイネージのトークンを発行する

部室のディスプレイに貼る URL を作ります。**端末ごとに1枚**発行してください。漏れたときに、その端末の分だけ止められます。

**先に `PUBLIC_BASE_URL` が入っていることを確かめます。**

```bash
dc exec -T backend bin/rails runner 'puts ENV.fetch("PUBLIC_BASE_URL")'
```

`KeyError` が出たら `.env.production` を直して `dc up -d`（**`restart` では反映されません**）。未設定のままだとサイネージも `/admin/signage` も 500 になります。

発行は管理画面からできます。`/admin/signage` を開いて名前（例: `部室メインディスプレイ`）を入れるだけです。URL はその場に出るのでコピーしてください。

画面を使わない場合はこちらです。**渡すのは名前だけで、トークンはサーバーが作ります。**

```bash
dc exec -T backend bin/rails runner '
st = SignageToken.create!(name: "部室メインディスプレイ")
puts "token=#{st.token}"
puts "url=#{st.signage_url}"'
```

出た URL をディスプレイ端末のブラウザで開きます。

```
http://<VPSのIP>/signage?token=<32桁>
```

確認するのは3つです。

```bash
curl -s -o /dev/null -w 'valid=%{http_code}
'   "http://<VPSのIP>/api/signage?token=<TOKEN>"   # 200
curl -s -o /dev/null -w 'invalid=%{http_code}
' "http://<VPSのIP>/api/signage?token=deadbeef"  # 404
```

3つ目は目で見ます。**サイネージに出ている企画の QR を読んで、`<VPSのIP>` を指していること。** ここが `localhost` になっていたら `PUBLIC_BASE_URL` が違っています（QR の URL はサーバー側で組み立てています）。

### トークンを止める

`/admin/signage` の失効ボタン、または次のコマンドです。**行は消しません**（いつ止めたかを残すため）。

```bash
dc exec -T backend bin/rails runner 'SignageToken.order(:id).each { |t| puts [t.id, t.name, t.revoked_at].join("	") }'
dc exec -T backend bin/rails runner 'SignageToken.find(<ID>).update!(revoked_at: Time.current)'
```

止めた端末には「このディスプレイのURLは無効です」と出ます。**有効期限はありません。** 止めるまで有効です。

---

## 2. 更新する（2回目以降）

**手で打つことはありません。`main` にマージすると自動で出ます。**

```
feat/xxx ──PR──> develop ──PR──> main ──自動──> 本番
                （溜める）      （出す）
```

`develop` → `main` の PR を**マージコミット**でマージすると、`.github/workflows/deploy.yml` が動きます。

> **squash にしないこと。** `develop` と `main` は長く並走するので、squash すると履歴が切り離され、次のマージで必ず衝突します（実際に起きました）。`feat/xxx` → `develop` は squash で構いません。

### CD が何をしているか

| | 場所 | 内容 |
|---|---|---|
| 1 | Actions | backend / frontend をビルドし、`:latest` と `:<コミットSHA>` の2つのタグで ghcr.io へ push |
| 2 | VPS | `docker-compose.prod.yml` と `ops/` を scp して `chmod +x` |
| 3 | VPS | **`./ops/backup.sh`**（戻せる状態を作ってから進む） |
| 4 | VPS | `dc pull` → `dc up -d` → `dc exec backend bin/rails db:migrate` |
| 5 | VPS | `/healthz` が返るまで最大30秒待って確認 |

**VPS ではビルドしません。** 2GBしかなく、メモリ不足で落ちるためです（`docs/spec-v2.2.md` §7.4）。

**`.env.production` は送られません。** リポジトリに無いので、変更するときは VPS で直接編集して `dc up -d` します。

### 失敗したとき

Actions が赤くなります。**赤いのに画面が動いていることがあります** — `up -d` まで成功して `db:migrate` で落ちた場合です。ログの最後まで読んでどこで止まったかを見てください。

### 切り戻す

`:<コミットSHA>` のタグが毎回残るので、そこへ戻します。

```bash
cd /opt/circleboard
vi .env.production
# BACKEND_IMAGE=ghcr.io/rengemaru/circleboard-backend:<戻したいSHA>
# FRONTEND_IMAGE=ghcr.io/rengemaru/circleboard-frontend:<戻したいSHA>
dc up -d
```

戻したい SHA は、GitHub の Actions のログか `git log origin/main` で分かります。

**マイグレーションを含む更新は、これだけでは戻りません。** DBのスキーマは前に進んだままなので、§4 の復元が要ります。CD が毎回バックアップを取っているので、直前の状態は `backups/` にあります。

### 手で出したいとき

CD が使えないときの逃げ道です。

```bash
# 開発機で（§1-1 と同じ）
docker build -t ghcr.io/rengemaru/circleboard-backend:latest ./backend
docker push ghcr.io/rengemaru/circleboard-backend:latest
# VPS で
dc pull && dc up -d && dc exec -T backend bin/rails db:migrate
```

**ただし Windows でビルドしたイメージは、Linux でビルドしたものと実行権限が違います。** `backend/bin/*` が 100644 のままだと `bin/rails` が動きません（一度踏みました）。常用しないでください。

---

## 3. ドメインと HTTPS

**設定済みです。** 公開URLは **https://cb.fukupro.club** です。

| 項目 | 値 |
|---|---|
| DNS | Cloudflare の A レコード。`cb` → `160.251.200.200`、**Proxy は DNS only** |
| 証明書 | Let's Encrypt。**Caddy が自動取得・自動更新** |
| `SITE_ADDRESS` | `cb.fukupro.club` |
| `ALLOWED_HOSTS` | `cb.fukupro.club` |
| `PUBLIC_BASE_URL` | `https://cb.fukupro.club` |
| `FORCE_SSL` | **行ごと無し**（既定の `true`） |

**Cloudflare の Proxy をオンにしないでください（オレンジの雲）。** ACME の確認要求が Cloudflare に吸われ、**Caddy が証明書を更新できなくなります。** 更新は90日ごとなので、切り替えた直後ではなく数か月後に切れます。

IP 直打ち（`http://160.251.200.200`）は `ALLOWED_HOSTS` から外れたので使えません。

### ドメインを変えるとき

**サイネージの QR に載っている URL が変わります。** 貼ってある QR と、部室の端末に設定した URL を作り直すことになります。トークン自体は有効なままです。

HSTS を `max-age=63072000`（2年）で返しているので、**一度ブラウザが覚えると2年間 http でアクセスできません。**

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
| **サイネージと `/admin/signage` が 500** | `PUBLIC_BASE_URL` が未設定。`SignageToken#signage_url` の `ENV.fetch` に既定値が無く、トークンの一覧・発行も同じ所を踏む |
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
