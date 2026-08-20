# CircleBoard API 仕様書 v1.0

対応する実装仕様: `spec-v2.2.md`
形式: Rails APIモード / JSON / セッションCookie認証

---

## 共通仕様

### ベースURL

```
開発: http://localhost:3000/api
本番: https://<ドメイン>/api
```

### 認証

サーバー側セッション + HttpOnly Cookie。フロントは `fetch` に `credentials: 'include'` を付ける。
**トークンをlocalStorageに保存しない**（XSSでの窃取を避けるため）。

### JSONキーの命名

`snake_case`（Rails側に合わせ、フロントで変換しない）。

### 認証状態の3分類

| 状態 | 判定 | `current_user` |
|---|---|---|
| ゲスト | Cookieなし | `nil` |
| メンバー / 管理者 | セッションCookieあり | Userオブジェクト |
| **サイネージ** | `?token=` が有効 | **`nil`**（ユーザーではない） |

サイネージは「認証は通っているがユーザーではない」状態。シリアライザには `current_user: nil` を渡す。

### エラーレスポンス

```json
{ "error": { "code": "unauthorized", "message": "ログインしてください" } }
```

| ステータス | 使う場面 |
|---|---|
| 400 | パラメータの形式が不正 |
| 401 | 未ログイン |
| 403 | ログイン済みだが権限が足りない |
| 404 | 存在しない / 論理削除済み / 無効なサイネージトークン |
| 422 | バリデーションエラー、定員超過 |
| 429 | レート制限（rack-attack） |

**403と404の使い分け:** 存在を隠したいものは404を返す。サイネージトークンが無効な場合は401ではなく**404**（トークンの存在有無を推測させないため）。

---

## 1. セッション

### `POST /api/session` — ログイン

```json
// リクエスト
{ "email": "taro@example.ac.jp", "password": "password123" }

// 200
{ "user": { "id": 1, "name": "山田太郎", "role": "member" } }
```

- 認証失敗は **401**。「メールアドレスが存在しない」と「パスワードが違う」を区別しない
- `rack-attack` で同一IPから5回/分に制限

### `DELETE /api/session` — ログアウト
→ 204

### `GET /api/session` — 現在のユーザー

```json
// 200（ログイン済み）
{ "user": { "id": 1, "name": "山田太郎", "role": "member" } }

// 200（未ログイン）
{ "user": null }
```

未ログインでも**401ではなく200 + null**を返す。フロントの初期化で毎回叩くため、エラー扱いにしない。

---

## 2. イベント

### `GET /api/events` — 一覧 🔓ゲスト可

| クエリ | 内容 |
|---|---|
| `tag_id` | タグで絞り込み |
| `status` | `recruiting` / `completed`（既定は `recruiting`） |

**並び順:** ピン留めが先頭 → `spotlight_score` 降順 → `starts_at` 昇順（画面①の注記）。
`pinned` は返すが、**`spotlight_score` は返さない**（画面 A2「一般ユーザーには見せない」）。
順序には使うが、数値そのものは公開しない。

```json
{
  "events": [
    {
      "id": 12,
      "title": "新歓ハッカソン2026",
      "description": "初心者大歓迎！...",
      "location": "部室A",
      "starts_at": "2026-09-28T10:00:00+09:00",
      "capacity": 20,
      "participants_count": 8,
      "status": "recruiting",
      "external_url": null,
      "tags": [{ "id": 3, "name": "ハッカソン" }]
      // owner はログイン時のみ追加される
    }
  ]
}
```

### `GET /api/events/:id` — 詳細 🔓ゲスト可

一覧と同じ形。**ログイン時のみ** 以下が追加される。

```json
{
  "owner": { "id": 4, "name": "佐藤花子" },
  "participants": [{ "id": 1, "name": "山田太郎" }],
  "current_user_joined": true
}
```

- `visibility: trashed` は **404**
- 一覧と詳細で**同じ `EventSerializer` を使う**（片方だけ塞ぐ漏れを防ぐ）
- **企画者が退会済みの場合は `owner: null`**（キーは残る）。仕様書 §4.2 のサンプルコードが
  `@event.owner && {...}` と書いているのに合わせている。フロントは `owner` が null になりうる前提で型を定義すること

### `POST /api/events` — 作成 🔒メンバー

```json
{
  "event": {
    "title": "LT大会 vol.13",
    "description": "...",
    "location": "情報棟202",
    "starts_at": "2026-10-05T19:00:00+09:00",
    "capacity": 30,
    "external_url": null,
    "tag_ids": [5, 9]
  }
}
```
→ 201。`owner_id` は `current_user` から設定する（**リクエストの値を信用しない**）。

### `PATCH /api/events/:id` — 編集 🔒owner / admin

→ 200。**レスポンスは `GET /api/events/:id`（詳細）と同じ形**。`POST` の 201 も同様。
別の形を返す実装にしないこと（同じシリアライザを使い回す原則の延長）。

### `DELETE /api/events/:id` — 論理削除 🔒owner / admin
→ 204。`visibility: trashed` に更新。物理削除しない。

### `POST /api/events/:id/participation` — 参加表明 🔒メンバー

→ 201 / 422（満員）/ 422（既に参加中）

**満員判定は必ずサーバー側で行う。** フロントのボタン非表示は表示の話であって制限ではない。

### `DELETE /api/events/:id/participation` — キャンセル 🔒メンバー

→ 204。`cancelled_at` に時刻を入れる（**物理削除しない**。注目スコアの集計に使う）。

---

## 3. プロジェクト 🔒すべてログイン必須

未ログインは一覧・詳細ともに **401**。

### `GET /api/projects` — 一覧
### `GET /api/projects/:id` — 詳細

```json
{
  "id": 3,
  "title": "Webアプリ開発チーム",
  "description": "...",
  "activity_schedule": "毎週土曜",
  "meeting_schedule": "毎週水曜 19:00〜",
  "capacity": 6,
  "participants_count": 2,
  "status": "recruiting",
  "owner": { "id": 4, "name": "佐藤花子" },
  "tags": [{ "id": 1, "name": "Web開発" }],
  "participants": [{ "id": 1, "name": "山田太郎" }],
  "current_user_joined": false
}
```

### `POST /api/projects` / `PATCH /api/projects/:id` / `DELETE /api/projects/:id`

イベントと同じ形。`status` は `recruiting` / `in_progress` / `completed` の3値。

### `POST /api/projects/:id/participation` — 参加申請 🔒メンバー

→ 201。MVPでは即時承認（`status: approved`、`approved_at` は現在時刻）。

**脱退APIは作らない**（MVP対象外。`rails console` で対応）。

---

## 4. タグ

### `GET /api/tags` — 一覧 🔓ゲスト可

```json
{ "tags": [{ "id": 1, "name": "Web開発" }] }
```

`category: project_event` のみ返す。**タグの作成APIは作らない**（`seeds.rb` と `rails console` で管理）。

---

## 5. サイネージ

### `GET /api/signage?token=xxx` 🎫トークン認証

サイネージ画面が必要とするデータを**1リクエストで返す**（60秒ごとに叩かれるため、リクエスト数を最小化する）。

```json
{
  "spotlight_events": [
    {
      "id": 12,
      "title": "新歓ハッカソン2026",
      "starts_at": "2026-09-28T10:00:00+09:00",
      "days_until": 3,
      "location": "部室A",
      "description": "初心者大歓迎！...",
      "tags": [{ "id": 3, "name": "ハッカソン" }],
      "pinned": true,
      "detail_url": "https://<ドメイン>/events/12"
    }
  ],
  "projects": [
    {
      "id": 3,
      "title": "Webアプリ開発チーム",
      "status": "recruiting",
      "participants_count": 2,
      "capacity": 6,
      "meeting_schedule": "毎週水曜 19:00〜",
      "tags": [{ "id": 1, "name": "Web開発" }],
      "detail_url": "https://<ドメイン>/projects/3"
    }
  ]
}
```

**仕様**

| 項目 | 内容 |
|---|---|
| `spotlight_events` の件数 | 最大4件 |
| 並び順 | ピン留めが常に先頭 → 残りは `spotlight_score` 降順 |
| 除外 | `starts_at` が過去 / `completed` / `trashed` |
| `projects` の件数 | 最大6件 |
| 並び順 | `recruiting` → `in_progress`。`completed` は除外 |
| `owner` | **含めない**（`current_user` が nil のため自動的に落ちる） |
| `participants` | **含めない** |
| 無効・失効トークン | **404** |
| レート制限 | 同一IPから30回/分 |

`detail_url` はサーバー側で `ENV['PUBLIC_BASE_URL']` から組み立てる。フロントでURLを組み立てない（サイネージ端末の設定に依存させないため）。

---

## 6. 管理者 🛡admin のみ

**すべてのエンドポイントで `role: admin` を検証する。** フロントでメニューを隠すだけにしない。
admin以外のログインユーザーは **403**、未ログインは **401**。

### `GET /api/admin/dashboard` — 管理者トップの集計（Phase 7 で追加）

`wireframes/wireframe-admin-ver2.html` ① 用。集計を1本にまとめているのは、
画面が開くたびに3往復させないため。別々に取ると数字が互いにずれる。

```json
{
  "stats": {
    "member_count": 42,
    "graduate_count": 8,
    "active_project_count": 6,
    "recruiting_project_count": 3,
    "events_this_month_count": 4,
    "suspended_count": 1,
    "next_event": { "id": 12, "title": "LT大会 vol.13", "days_until": 3 }
  },
  "recent_activity": [
    {
      "id": 12,
      "kind": "event",
      "title": "LT大会 vol.13",
      "status": "recruiting",
      "owner_name": "山田太郎",
      "created_at": "2026-08-01T10:00:00+09:00"
    }
  ]
}
```

- `next_event` は開催予定が無ければ `null`。対象は `Event.spotlight_targets`
  （開催当日は23時まで含む）と同じ定義を使う
- `active_project_count` は「終了していない」件数。募集中も含む
- `recent_activity` はイベントとプロジェクトを混ぜて新しい順に最大5件
- `owner_name` は退会で `null` になりうる

### `GET /api/admin/users` — ユーザー一覧（Phase 7 で追加）

`wireframes/wireframe-admin-ver2.html` ② 用。

```json
{
  "users": [
    {
      "id": 3,
      "name": "鈴木一郎",
      "email": "ichiro@example.ac.jp",
      "role": "member",
      "enrollment_year": 2024,
      "graduation_year": 2028,
      "graduated": false,
      "suspended": false,
      "suspended_at": null
    }
  ]
}
```

- 公開APIの `UserSerializer` は `email` を返さない（`spec-v2.2.md` §4.1 の
  アクセス制御表に無いため意図的に落としている）。この画面だけが受け取る
- `graduated` はサーバーが判定する。日本の学年は4月始まりで卒業は3月なので、
  年度の切り替わりを跨ぐ規則になる。画面ごとに計算させると Ruby と
  TypeScript に同じ規則が2本並ぶ（`User#graduated?`）
- 卒業年度の新しい順。検索と絞り込みのクエリは受けない。部員は数十人で、
  1文字打つたびに往復させる意味がないため画面側で絞る

### `PUT /api/admin/users/:user_id/suspension` — 停止（Phase 7 で追加）
### `DELETE /api/admin/users/:user_id/suspension` — 停止解除

```json
{ "id": 3, "suspended": true, "suspended_at": "2026-08-20T22:06:23+09:00" }
```

**停止は表示上のラベルではない。** サーバー側で次の2つを行う（`spec-v2.2.md` §2.1）。

1. `POST /api/session` を **403** で拒否する
2. **すでに発行済みのセッションも無効化する。** `current_user` が `nil` を返すので、
   停止した瞬間からその人は未ログイン扱いになる。`GET /api/session` は
   `{ "user": null }`、ログイン必須のエンドポイントは 401

2番が無いと、停止しても本人がブラウザを開いたままなら操作を続けられる。

- **自分自身は 422。** 停止した瞬間に自分のセッションが切れ、管理画面から
  締め出されて解除もできなくなる
- 存在しないIDは 404
- 停止しても企画と参加記録は消さない。停止は削除ではない

### `DELETE /api/admin/users/:id` — ユーザー削除（Phase 7 で追加）

→ 204。物理削除。外部キーがすべて `ON DELETE SET NULL` なので、その人が作った
企画と参加記録は残り、`owner_id` / `user_id` だけが `null` になる。

- **自分自身は 422。** 管理者は他の管理者を消せるが、消した本人が管理者として
  残るため、これだけで管理者が0人になることは起こらない
- 存在しないIDは 404

### `POST /api/admin/users` — アカウント発行

```json
{
  "user": {
    "name": "鈴木一郎",
    "email": "ichiro@example.ac.jp",
    "password": "初期パスワード",
    "enrollment_year": 2026,
    "graduation_year": 2030,
    "role": "member"
  }
}
```
→ 201

### `GET /api/admin/events` — ピン留め設定画面用の一覧（実装時に追加）

```json
{
  "events": [
    {
      "id": 12, "title": "新歓ハッカソン2026",
      "starts_at": "2026-09-28T10:00:00+09:00", "location": "部室A",
      "participants_count": 8, "spotlight_score": 210, "pinned": true
    }
  ]
}
```

**公開APIと分けている理由:** `wireframes/wireframe-admin.html` A2 が
「score はこの画面にだけ表示する。**一般ユーザーには見せない**（数値が見えると、
順位を上げるための操作を誘発するため）」と定めている。
`spotlight_score` を `GET /api/events` に足すとこの要求を破るため、管理者専用に持つ。

開催前のイベントのみ。並び順はピン留めが先頭 → `spotlight_score` 降順。

### `PUT /api/admin/events/:id/pin` — ピン留め設定

→ 200。**既存のピンを外す処理と新しいピンを立てる処理を同一トランザクションで行う**（部分ユニークインデックスに衝突するため）。

### `DELETE /api/admin/events/:id/pin` — ピン留め解除
→ 204

### `GET /api/admin/signage_tokens` — トークン一覧

```json
{
  "signage_tokens": [
    {
      "id": 1,
      "name": "部室メインディスプレイ",
      "token": "a1b2c3...",
      "url": "https://<ドメイン>/signage?token=a1b2c3...",
      "revoked_at": null,
      "created_at": "2026-09-01T10:00:00+09:00"
    }
  ]
}
```

### `POST /api/admin/signage_tokens` — 発行

```json
{ "signage_token": { "name": "部室メインディスプレイ" } }
```
→ 201。`token` は `SecureRandom.hex(16)` で生成。

### `DELETE /api/admin/signage_tokens/:id` — 無効化

→ 204。`revoked_at` に時刻を入れる（**行を消さない**。どのトークンをいつ止めたかの記録を残す）。

---

## 7. ヘルスチェック

### `GET /healthz` 🔓

```json
{ "status": "ok" }
```

`/api` 配下ではない。認証不要。DBに触らない（DBが落ちていても200を返し、アプリの生死とDBの生死を分けて観測できるようにする）。

---

## 付録: 認可の早見表

| エンドポイント | ゲスト | メンバー | owner | admin | サイネージ |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /events` `GET /events/:id` | ✅ | ✅ | ✅ | ✅ | — |
| └ レスポンスに `owner` を含む | ❌ | ✅ | ✅ | ✅ | ❌ |
| └ レスポンスに `participants` を含む | ❌ | ✅ | ✅ | ✅ | ❌ |
| `POST /events` | ❌ | ✅ | ✅ | ✅ | — |
| `PATCH` / `DELETE /events/:id` | ❌ | ❌ | ✅ | ✅ | — |
| `POST /events/:id/participation` | ❌ | ✅ | ✅ | ✅ | — |
| `GET /projects` `GET /projects/:id` | ❌ | ✅ | ✅ | ✅ | — |
| `GET /tags` | ✅ | ✅ | ✅ | ✅ | — |
| `GET /api/signage` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/api/admin/*` | ❌ | ❌ | ❌ | ✅ | ❌ |
