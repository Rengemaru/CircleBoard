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
| `tag_ids` | タグで絞り込み。カンマ区切りで複数指定でき、**複数のときは OR** |
| `status` | `recruiting` / `completed`（既定は `recruiting`） |
| `q` | 企画名の部分一致。大文字小文字は区別しない |

`tag_ids` は `?tag_ids=1,3` の形。空・未指定・数字でない値は「絞り込まない」に倒す。
URL を手で書き換えられてもエラーにせず全件を返す。

`q` も同じ考え方で、空・空白だけ・100字を超える語は「絞り込まない」に倒す。
企画名の上限が100字（`Event::MAX_TITLE_LENGTH` / `Project::MAX_TITLE_LENGTH`）なので、
超える語はどのみち0件になる。

**`%` と `_` はワイルドカードにしない。** `sanitize_sql_like` で打ち消しているので、
`?q=50%` は「50%」を含む企画だけを返す。`status` や `tag_ids` と重ねたときは AND。

**AND ではなく OR にしている。** 「Web開発 か ゲーム制作」を見たい人がいるため。
AND だとタグを足すほど結果が減り、0件になりやすい。

**`recruiting` は開催日が過ぎたものを含めない**（既定・明示のどちらでも）。
「まだ開催されていない」の基準はサイネージと同じで、**開催当日は23時まで含める**
（`Event.upcoming`。§5 の除外条件と同じ判定を使う）。

`status` を `completed` にしたときは日付で絞らない。終わったものを見に行く指定であり、
日付で絞ると必ず0件になるため。

> **この条件を足した理由（2026-08-24 に追加）**
> `status` を `completed` に変え忘れた企画は運用上必ず出る。
> 日付で絞らないと、トップページと一覧に「あと-1日」の企画が並ぶ。

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
      // owner と current_user_joined はログイン時のみ追加される
    }
  ]
}
```

> **`current_user_joined` を一覧にも足した理由（2026-09-10 に追加）**
> マイページの「参加中の企画」が必要とする（Issue #165）。
> 詳細を1件ずつ引くと、参加数だけリクエストが増える。
> `GET /api/projects` は元から一覧で返しており、これで形が揃う。
> 未ログインではキーごと存在しない点も owner と同じ。

### `GET /api/events/:id` — 詳細 🔓ゲスト可

一覧と同じ形。**ログイン時のみ** 以下が追加される。

```json
{
  "owner": { "id": 4, "name": "佐藤花子" },
  "current_user_joined": true,
  "participants": [{ "id": 1, "name": "山田太郎" }]
}
```

`participants` だけは詳細のみ。名前の並びは一覧の1行に入れるものではない。

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
    "tag_names": ["LT", "初心者歓迎"]
  }
}
```
→ 201。`owner_id` は `current_user` から設定する（**リクエストの値を信用しない**）。

`tag_names` は**名前**で受け取る。**まだ存在しないタグはIDを持てない**ため
（`docs/spec-tags.md` §3.7）。正規化してから引き、無ければその場で作る（`category: project_event`）。
5件まで・1件20字まで。超えると 422。**絞り込みの `?tag_ids=` は据え置き**で、こちらは作成を伴わないため ID のまま。

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

### `PATCH /api/users/me` に `name` を足す（2026-09-12）

プロフィールの更新で氏名も変えられるようにします。受け取るキーに `name` が増えるだけで、
形は変わりません。`email` / `role` / 年度は引き続き受け取りません。

**氏名は本人と管理者の両方が変えられます**（オーナー決定 2026-09-12）。管理者側は
`PATCH /api/admin/users/:id` に `name` を足します。同じことをする入口が2つになりますが、
改姓は本人が、打ち間違いは発行した管理者が直すのが自然なため、どちらも残します。

---

### `PATCH /api/users/me/password` — 本人によるパスワード変更

| キー | 必須 | 内容 |
|---|---|---|
| `current_password` | ✅ | いま使っているパスワード |
| `password` | ✅ | 新しいパスワード（8文字以上） |

成功は **204**（本文なし）。現在のパスワードが違っても短すぎても **422**。

**現在のパスワード違いを 401 にしない。** このリポジトリでは 401 に「ログインし直せ」
という意味を持たせていて、画面が受け取ると再ログインの案内を出す（Issue #72）。
セッションは切れていないので、そこに混ぜると「有効期限が切れました」と誤って出る。

**現在のパスワードを必ず検証する。** ログイン中であることは「本人である」ことの証明に
ならない。これが無いと、席を外した隙に画面を触られただけで乗っ取りが固定化する。

パスを `/users/me` の1本にして、他人を指せる形そのものを作らない（`PATCH /api/users/me` と同じ）。

> **⚠️ パスワードを変えても、他の端末で開いたままのセッションは切れません。**
> セッションは `session[:user_id]` しか持っていないため。切るには `users` に
> `session_token` 列が要り、`spec-v2.2.md` §2 に触る。別途判断。

---

### `GET /api/projects` — 一覧

| クエリ | 既定 | 意味 |
|---|---|---|
| `status` | **終了以外** | `recruiting` / `in_progress` / `completed`。未知の値は既定に戻す |
| `tag_ids` | なし | タグで絞り込み。カンマ区切りで複数指定でき、**複数のときは OR**（`GET /api/events` と同じ） |
| `q` | なし | 企画名の部分一致（`GET /api/events` と同じ。同じ concern を共有している） |

並び順は **募集中 → 進行中**（`wireframes/wireframe-member.html` 画面④）。
enum の整数（0:recruiting 1:in_progress 2:completed）がそのままこの順序なので、
`status` で並べるだけでよい。

**進行中も既定で返す。** 途中参加できる設計のため。終了は返さない
（「過去の企画」セクションは MVP 対象外。`CLAUDE.md` §10）。

イベントと違い注目スコアは使わない。プロジェクトには開催日が無く、
締切感が存在しないため（`wireframe-signage.html`）。

### プロジェクトの脱退（2026-09-12 追加）

**脱退は申請制です。** プロジェクトは継続的に成果物を作る活動で、抜けられると owner が
引き継ぎを考える必要があります。黙って消えると気づけないので、イベントの参加キャンセルと
同じ「1クリックで抜ける」にはしません。

| メソッド | パス | 誰が | 何をするか |
|---|---|---|---|
| `POST` | `/api/projects/:id/withdrawal` | 参加している本人 | 脱退を申請する |
| `DELETE` | `/api/projects/:id/withdrawal` | 申請した本人 | 申請を取り下げる |
| `PUT` | `/api/projects/:project_id/withdrawals/:id` | owner / 管理者 | 申請を承認して抜けさせる |
| `DELETE` | `/api/projects/:project_id/withdrawals/:id` | owner / 管理者 | 申請を却下する |

前の2本は「自分の参加」しか指せないので `:id` を取りません（`/users/me` と同じ考え方）。
後ろの2本は owner が他人の申請を捌くので、申請のIDを取ります。

- 参加していない人が申請すると **404**（参加の有無を隠す）
- すでに申請中のものをもう一度申請すると **422**
- owner でも管理者でもない人が承認・却下すると **403**
- **owner 自身は脱退できません**（**422**）。抜けると持ち主のいない企画が残ります。
  owner の付け替えは MVP 対象外（co_organizer と同じ）

承認は `cancelled_at` に時刻を入れるだけで、**行は消しません**。参加していた事実は残ります。
抜けたあと同じプロジェクトに参加し直せます（部分ユニークインデックス）。

成功はいずれも **204**（本文なし）。

**`GET /api/projects/:id` が返す情報**（2026-09-12 追加）

| キー | 誰に返るか | 内容 |
|---|---|---|
| `current_user_withdrawal_requested` | ログイン中の全員 | 自分が脱退を申請しているか |
| `withdrawal_requests` | **owner と管理者だけ** | `[{ id, user }]`。捌くための一覧 |

`withdrawal_requests` は owner と管理者以外には**キーごと返しません**。
誰が抜けたがっているかは、他の参加者に見せる情報ではありません（`CLAUDE.md` §3-2）。

---

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

`?category=project_event|profile` で語彙を絞る。省略時と知らない値は `project_event`
（企画用とプロフィール用で語彙を分ける。`docs/spec-tags.md` §3.4）。

**タグ単体を作るAPIは作りません。** タグは企画かプロフィールに付ける過程で生まれます（`docs/spec-tags.md` §3.5）。
こうすると、どこにも付いていないタグが生まれにくくなります。

### `GET /api/admin/tags` — 一覧 🔒管理者

```json
{ "tags": [{ "id": 1, "name": "Web開発", "category": "project_event", "usage_count": 3 }] }
```

`usage_count` は イベント・プロジェクト・プロフィールに付いている数の合計。

### `PATCH /api/admin/tags/:id` — 改名 🔒管理者

`{ "tag": { "name": "Web" } }` → 200。`category` は変えられない
（企画に付いているタグをプロフィール用に移すと、その企画からタグが消えるため）。

### `DELETE /api/admin/tags/:id` — 削除 🔒管理者

→ 204。**`usage_count` が1以上なら 422。** 中間テーブルが `ON DELETE CASCADE` なので、
消すと企画から黙ってタグが外れます。

**管理画面に作成はありません**（§3.8。ここは「直す場所」）。

---

## 4.5 プロフィール 🔒すべてログイン必須

2026-09-10 追加（`docs/spec-my-page.md`）。**未ログインには一切返さない**（`spec-v2.2.md` §4.1）。

> 節番号を 4.5 にしているのは、コード中のコメントが「api-spec.md §5」「§6」で
> サイネージと管理者APIを指しているため。5 以降を繰り下げると、その参照が全部ずれる。

### `GET /api/users/me` — 自分

```json
// 200
{
  "id": 2,
  "name": "山田太郎",
  "email": "taro@example.ac.jp",
  "department": "情報工学科",
  "bio": "Webアプリを作っています。
React と Rails を触っています。",
  "enrollment_year": 2026,
  "graduation_year": 2030,
  "tags": [{ "id": 1, "name": "Web開発" }],
  "links": [{ "id": 1, "label": "GitHub", "url": "https://github.com/xxx" }]
}
```

### `GET /api/users/:id` — 他の人

`GET /api/users/me` と同じ形だが、**`email` を返さない。** 他人のメールアドレスを配る理由がない。

`role` と `suspended_at` は**どちらでも返さない。** 管理画面の情報であって、プロフィールではない。

`links` は `position` の昇順。

### `PATCH /api/users/me` — 更新

```json
// リクエスト
{
  "department": "情報工学科",
  "bio": "…",
  "tag_names": ["3D", "Blender"],
  "links": [{ "label": "GitHub", "url": "https://github.com/xxx" }]
}
```

- **`name` / `email` / `role` / `enrollment_year` / `graduation_year` は受け付けない。**
  名前を変えられると、参加者一覧でも主催欄でも他人になりすませる。変更は管理者の仕事（Issue #4）。
  `event_params` で `owner_id` を許可していないのと同じ考え方（§2）
- **更新対象は必ず `current_user`。** パスは `/me` の1本だけで、他人を指せる形を作らない
- `links` は**丸ごと置き換え**。配列の順序がそのまま `position` になる。
  行ごとのAPIにすると画面の操作と1対1にならず往復が増える
- 置き換えはトランザクションの中で行う。途中で失敗したときに、
  古い行が消えて新しい行が入っていない状態を残さないため

検証に失敗したら **422**。

| 対象 | 制約 |
|---|---|
| `department` | 50字まで |
| `bio` | 500字まで |
| `tag_names` | 5件まで。1件20字まで。無い名前はその場で作られる（`category: profile`） |
| `links` | 3件まで |
| `links[].label` | 必須・20字まで |
| `links[].url` | 必須・`http://` または `https://` で始まること |

**`url` のスキームを見るのは `javascript:` を弾くため。** フロントでも弾くが、
`curl` で回避できるので**サーバー側を正とする**。

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
    "grade_years": 3,
    "role": "member"
  }
}
```
→ 201

**年度は受け取らない。** `grade_years`（在学何年目か。1〜9）から入学年度と卒業年度を
サーバーが逆算する。部員ぶんの年度を人手で入れるのは現実的でないため
（オーナー決定 2026-09-11）。範囲の外なら 422。

### `PATCH /api/admin/users/:id` に `name` を足す（2026-09-12）

権限・学年に加えて氏名も受け取ります。打ち間違いを発行した管理者が直せるようにするため。
**メールアドレスは引き続き受け取りません**（`rails console`）。

---

### `PUT /api/admin/users/:user_id/password` — パスワードの再発行

| キー | 必須 | 内容 |
|---|---|---|
| `password` | ✅ | 新しいパスワード（8文字以上） |

成功は **204**（本文なし）。短すぎれば **422**、存在しないIDは **404**。

**現在のパスワードは求めない。** 忘れた人が対象なので、本人も知らない。
設定した値は口頭かDMで本人に伝える（アカウント発行の初期パスワードと同じ運用）。

通知機能を作らない方針（`CLAUDE.md` §10）なので、メールでリセットリンクを送る方式は
採れない。本人が自分で変える経路は `PATCH /api/users/me/password`。

### `GET /api/admin/posts` — 企画一覧・全件（Phase 7 で追加）

`wireframes/wireframe-admin-ver2.html` ④ 用。イベントとプロジェクトを1つの配列に混ぜ、
**論理削除済み（`visibility: trashed`）も含めて**返す。

```json
{
  "posts": [
    {
      "id": 12, "kind": "event", "title": "新歓ハッカソン2026",
      "status": "recruiting", "trashed": false,
      "owner_name": "田中太郎", "capacity": 20,
      "participants_count": 8, "created_at": "2026-04-20T18:00:00+09:00"
    },
    {
      "id": 3, "kind": "project", "title": "不適切な投稿",
      "status": "recruiting", "trashed": true,
      "owner_name": null, "capacity": null,
      "participants_count": 0, "created_at": "2026-03-10T12:00:00+09:00"
    }
  ]
}
```

**公開APIと分けている理由:** `GET /api/events` と `GET /api/projects` は
論理削除済みを必ず外す。この画面は消したものを一覧して復旧する場所なので、
`trashed` が見えないと成立しない。

- 並び順は `created_at` の降順（投稿日の新しい順）。2つのテーブルを混ぜるため
  Ruby 側で並べる
- `status` はイベントが2値（`recruiting` / `completed`）、プロジェクトが3値
  （`recruiting` / `in_progress` / `completed`）。`trashed` は `visibility` 列であり
  `status` とは独立するので、別のキーで返す
- `participants_count` は公開APIと同じ数え方。イベントはキャンセル済みを除き、
  プロジェクトはそのまま数える
- `owner_name` は退会で `null` になりうる（`ON DELETE SET NULL`）
- 検索・絞り込みのクエリは受けない。件数が部内の企画数に留まるため画面側で絞る
  （`GET /api/admin/users` と同じ扱い）

### `DELETE /api/admin/events/:event_id/trash` — 論理削除の取り消し（Phase 7 で追加）
### `DELETE /api/admin/projects/:project_id/trash`

→ 204。`visibility` を `trashed` から `active` に戻す。

**削除側の入口を admin に作っていない理由:** 論理削除は `DELETE /api/events/:id` と
`DELETE /api/projects/:id` で owner 本人も行える一般の操作であり、管理者もそれを通る。
同じことをする入口を2本持たない。復旧だけがここにあるのは、公開APIが
`trashed` を必ず 404 にするため（消えたものに触れるのは管理者だけ）。

- 存在しないIDは 404
- すでに `active` な企画に対して呼んでも 204。結果が同じなのでエラーにしない

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
| `GET /users/me` `GET /users/:id` | ❌ | ✅ | ✅ | ✅ | ❌ |
| └ レスポンスに `email` を含む | ❌ | **本人のみ** | 本人のみ | 本人のみ | ❌ |
| `PATCH /users/me` | ❌ | **本人のみ** | 本人のみ | 本人のみ | ❌ |
| `GET /api/signage` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/api/admin/*` | ❌ | ❌ | ❌ | ✅ | ❌ |
