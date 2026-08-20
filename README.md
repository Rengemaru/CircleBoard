# CircleBoard

大学サークルの部室サイネージ兼企画掲示板。

部室のディスプレイに「次に何があるか」を常時映し、部員は同じデータを
スマホやPCから見て参加を表明できる。

- 仕様の正: [`docs/spec-v2.2.md`](docs/spec-v2.2.md)
- API仕様: [`docs/api-spec.md`](docs/api-spec.md)
- ER図: [`docs/er.md`](docs/er.md)
- 作業手順: [`docs/instructions.md`](docs/instructions.md)
- 開発規約: [`CLAUDE.md`](CLAUDE.md)
- 画面構造: [`wireframes/`](wireframes/)

## この実装で説明できること

| 論点 | どこを見るか |
|---|---|
| **注目スコアの設計** — なぜ参加者数の絶対値を使わないか | `backend/app/models/event.rb`、`spec-v2.2.md` §3 |
| **認可をAPIレスポンスで行う** — フロントで隠さない | `backend/app/serializers/event_serializer.rb` |
| **運用ルールをDB制約で表現する** — ピン留めは全体で1件 | `docs/er.md`、`backend/db/migrate/*_create_events.rb` |
| **N+1を作らない** — includes とスコープ付き関連 | `backend/app/models/event.rb` の `active_event_participations` |
| **トークン認証の運用設計** — 漏れた端末だけ止められる | `backend/app/controllers/api/signages_controller.rb` |

## 構成

| ディレクトリ | 中身 | ポート |
|---|---|---|
| `backend/` | Rails 7 (APIモード) | 3000 |
| `frontend/` | React + Vite + TypeScript | 5173 |
| — | PostgreSQL 16 | （ホストに公開しない） |

## 必要なもの

- Docker Desktop（Compose v2 以上）

## セットアップ

```bash
git clone https://github.com/Rengemaru/CircleBoard.git
cd CircleBoard
cp .env.example .env
docker compose up -d
```

**これだけで動きます。** 初回は依存のインストールに数分かかります。
各コンテナの起動スクリプト（`backend/docker-entrypoint.dev.sh` / `frontend/docker-entrypoint.dev.sh`）が
次を自動で行うためです。

| | 内容 |
|---|---|
| backend | 足りない gem があれば `bundle install` → `db:prepare`（DB作成・マイグレーション・seed）→ Puma 起動 |
| frontend | `node_modules` が空なら `npm install` → Vite 起動 |

いずれも**足りないときだけ**実行するので、2回目以降の起動は待たされません。
進み具合は `docker compose logs -f backend` の `[dev]` 行で追えます。

`.env` は `.gitignore` 済みです。実値をコミットしないでください。

### 起動確認

```bash
docker compose ps
```

3サービスとも `Up` で `db` が `healthy`、`http://localhost:5173` にイベントが4件並べば成功です。

同じPCで別プロジェクトが 3000 / 5173 を使っていてポート衝突する場合は、
`.env` の `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT` を変更してください。
コンテナ内のポートは変わりません。
### Windows (PowerShell) の場合

`cp` の代わりに:

```powershell
Copy-Item .env.example .env
```

`docker compose` 以降のコマンドは macOS と同じです。

### ソースを直しても画面が変わらないとき

`frontend/vite.config.ts` で `server.watch.usePolling` を有効にしてあります。
Docker のバインドマウント越しではホスト側のファイル変更イベントがコンテナ内に
伝わらず、Vite が古いコードを配信し続けるためです。
それでも反映されない場合は `docker compose restart frontend` を実行してください。

## 画面

| URL | 内容 | 認証 |
|---|---|---|
| `/` | トップ。注目イベントとプロジェクト | ゲスト可 |
| `/events` `/events/:id` | イベント一覧・詳細 | ゲスト可（表示内容が変わる） |
| `/projects` `/projects/:id` | プロジェクト一覧・詳細 | **要ログイン** |
| `/create` | 企画作成 | 要ログイン |
| `/login` `/legal` | ログイン・利用規約 | ゲスト可 |
| `/admin/users` `/admin/pins` `/admin/signage-tokens` | 管理者3画面 | **admin のみ** |
| `/signage?token=…` | 部室ディスプレイ用の全画面ビュー | トークン |

イベントはゲストも見られるが、**企画者名と参加者一覧はログインしないと返ってこない**。
フロントで隠しているのではなく、APIのレスポンスからキーごと落としている。

## サイネージを部室のディスプレイに映す

1. `/admin/signage-tokens` で端末ごとにトークンを発行する
2. 表示された URL を、その端末の Chrome でキオスクモードで開く

```bash
chrome --kiosk "https://<ドメイン>/signage?token=<発行したトークン>"
```

端末ごとに分けるのは、**漏れたときにその端末の分だけ止められる**ようにするため。
無効にしても行は消さないので、どの端末をいつ止めたかが管理画面から追える。

60秒ごとに自動で再読み込みします。時計はそれとは独立に毎秒動きます
（止まっている画面か動いている画面かが、遠目に分かるようにするため）。

## テスト・Lint

```bash
# Rails
docker compose exec backend bundle exec rspec      # テスト
docker compose exec backend bundle exec rubocop    # 静的解析
docker compose exec backend bundle exec rubocop -a # 自動修正

# React
docker compose exec frontend npm run lint
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run format        # Prettier
```

テストカバレッジは `rspec` 実行時に SimpleCov が計測し、`backend/coverage/index.html` に出ます。
**現時点では計測するだけで、閾値でCIを落とす設定にはしていません。**

テストは網羅的には書きません。優先順位は `CLAUDE.md` §6 のとおりで、
`Event#calculate_spotlight_score`（Phase 3 / T3-1）を最も厚く書きます。

## 注目スコアの日次更新

イベントの `spotlight_score` は cron で毎日7時に更新します（`backend/config/schedule.rb`）。

```bash
# 生成される crontab を確認する（書き込みはしない）
docker compose exec backend bundle exec whenever

# 手で1回実行する（cron を待たずに結果を見たいとき）
docker compose exec backend bin/rails runner 'Event.recalculate_spotlight_scores'
```

**開発環境では cron は動きません。** コンテナに cron を常駐させていないためです。
本番への反映は Phase 5（D-8）で `bundle exec whenever --update-crontab` を実行します。

スコアの計算式は `docs/spec-v2.2.md` §3 にあります。
「開催の近さ × 直近3日の勢い」で、参加者数の絶対値は使いません。

## よく使うコマンド

```bash
docker compose up -d          # 起動
docker compose down           # 停止
docker compose ps             # 状態確認
docker compose logs -f backend
docker compose exec db psql -U circleboard -d circleboard_development  # DBに入る
```

## 開発用データ

```bash
docker compose exec backend bin/rails db:seed
```

何度実行してもデータは増えません（`find_or_create_by` を使っています）。

### 開発用アカウント

パスワードは全員 `password123`（**開発環境専用**。本番では使わないこと）。

| メールアドレス | 名前 | role |
|---|---|---|
| `admin@example.ac.jp` | 部長 管理 | admin |
| `taro@example.ac.jp` | 山田太郎 | member |
| `hanako@example.ac.jp` | 佐藤花子 | member |
| `ichiro@example.ac.jp` | 鈴木一郎 | member |

### 投入されるデータ

タグ9件 / イベント4件 / プロジェクト3件（募集中2・進行中1）/ イベント参加7件（うちキャンセル済み2）/ サイネージトークン1件。

イベント4件のうち1件は終了済み（`status: completed`）です。`GET /api/events` は
既定で募集中のみを返すため、**画面に並ぶのは3件**になります（`?status=completed` で終了分を確認できます）。

イベントの開催日は **3日後 / 8日後 / 20日後 / 10日前** に散らしてあります。注目スコア（`docs/spec-v2.2.md` §3）は「開催の近さ」で大きく変わるため、動作確認にはこのばらつきが要ります。
