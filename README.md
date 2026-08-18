# CircleBoard

大学サークルの部室サイネージ兼企画掲示板。

- 仕様の正: [`docs/spec-v2.2.md`](docs/spec-v2.2.md)
- API仕様: [`docs/api-spec.md`](docs/api-spec.md)
- 作業手順: [`docs/instructions.md`](docs/instructions.md)
- 開発規約: [`CLAUDE.md`](CLAUDE.md)
- 画面構造: [`wireframes/`](wireframes/)

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

`.env` は `.gitignore` 済みです。実値をコミットしないでください。

### 起動確認

```bash
docker compose ps
```

`db` の STATUS が `healthy` になれば成功です。

同じPCで別プロジェクトが 3000 / 5173 を使っていてポート衝突する場合は、
`.env` の `BACKEND_HOST_PORT` / `FRONTEND_HOST_PORT` を変更してください。
コンテナ内のポートは変わりません。
`backend` / `frontend` は Rails・Vite を生成するまで待機状態で起動します（T1-2 / T1-3 で実体が入ります）。

### Windows (PowerShell) の場合

`cp` の代わりに:

```powershell
Copy-Item .env.example .env
```

`docker compose` 以降のコマンドは macOS と同じです。

## よく使うコマンド

```bash
docker compose up -d          # 起動
docker compose down           # 停止
docker compose ps             # 状態確認
docker compose logs -f backend
docker compose exec db psql -U circleboard -d circleboard_development  # DBに入る
```

## 開発用アカウント

Phase 1 の T1-5（seeds）で作成します。パスワードは全員 `password123`（**開発環境専用**）。
